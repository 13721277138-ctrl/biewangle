import { PRODUCT_CONFIG } from "./config.js";
import type {
  CheckRun,
  CheckRunItem,
  CheckRunItemState,
  ClosedEvent,
  Importance,
  OfficialTemplate,
  PersonalTemplate,
  TemplateIdentity,
  TemplateSnapshot,
} from "./schema.js";

export type StartableTemplate = OfficialTemplate | PersonalTemplate;

export type RunItemView = "all" | "key";

export class DomainTransitionError extends Error {
  constructor(
    public readonly code:
      | "runNotInProgress"
      | "itemNotFound"
      | "invalidReorder"
      | "planNotPending",
    message: string,
  ) {
    super(message);
    this.name = "DomainTransitionError";
  }
}

export interface StartRunOptions {
  checkRunId?: string;
  sourcePlannedCheckId?: string;
}

export interface CloseRunOptions {
  intent: "complete" | "endWithUnresolved" | "discard";
  now: string;
  keyRiskConfirmed?: boolean;
  closedEventId?: string;
}

export type CloseRunResult =
  | { kind: "completed"; run: CheckRun }
  | {
      kind: "needsKeyConfirmation";
      unresolvedCount: number;
      unresolvedKeyCount: number;
    }
  | { kind: "endedWithUnresolved"; run: CheckRun }
  | { kind: "discarded"; run: CheckRun }
  | {
      kind: "rejected";
      reason: "runNotInProgress" | "uncheckedItemsRemain";
      unresolvedCount: number;
      unresolvedKeyCount: number;
    };

export type ReopenRunResult =
  | { kind: "reopened"; run: CheckRun }
  | {
      kind: "unavailable";
      reason: "statusNotReopenable" | "windowExpired" | "missingCloseEvent";
    };

function deterministicId(kind: string, now: string, identity: string): string {
  const seed = `${kind}|${now}|${identity}`;
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return `${kind}.${Math.abs(hash >>> 0).toString(36)}`;
}

export function templateIdentityFor(source: StartableTemplate): TemplateIdentity {
  if ("templateId" in source) {
    return {
      kind: "official",
      templateId: source.templateId,
      contentVersion: source.contentVersion,
    };
  }
  return {
    kind: "personal",
    personalTemplateId: source.personalTemplateId,
    updatedAt: source.updatedAt,
  };
}

export function snapshotTemplate(source: StartableTemplate): TemplateSnapshot {
  return {
    title: source.title,
    ...("applicability" in source
      ? { applicability: source.applicability }
      : {}),
    groups: structuredClone(source.groups),
  };
}

function identityKey(identity: TemplateIdentity): string {
  return identity.kind === "official"
    ? `${identity.templateId}@${identity.contentVersion}`
    : `${identity.personalTemplateId}@${identity.updatedAt}`;
}

export function startRunFromSnapshot(
  sourceTemplateIdentity: TemplateIdentity,
  runTemplateSnapshot: TemplateSnapshot,
  now: string,
  options: StartRunOptions = {},
): CheckRun {
  const checkRunId =
    options.checkRunId ??
    deterministicId("run", now, identityKey(sourceTemplateIdentity));
  const items = runTemplateSnapshot.groups.flatMap((group) =>
    group.items.map((item) => ({ group, item })),
  );

  return {
    checkRunId,
    sourceTemplateIdentity: structuredClone(sourceTemplateIdentity),
    ...(options.sourcePlannedCheckId
      ? { sourcePlannedCheckId: options.sourcePlannedCheckId }
      : {}),
    runTemplateSnapshot: structuredClone(runTemplateSnapshot),
    status: "inProgress",
    items: items.map(({ group, item }, runSortOrder) => ({
      runItemId: `${checkRunId}:${item.itemId}`,
      sourceItemId: item.itemId,
      groupId: group.groupId,
      title: item.title,
      importance: item.importance,
      ...(item.condition ? { condition: item.condition } : {}),
      ...(item.hint ? { hint: item.hint } : {}),
      state: "unchecked",
      runSortOrder,
      isTemporary: false,
    })),
    startedAt: now,
    lastInteractedAt: now,
    closedEvents: [],
    reopenCount: 0,
  };
}

export function startRun(
  source: StartableTemplate,
  now: string,
  options: StartRunOptions = {},
): CheckRun {
  return startRunFromSnapshot(
    templateIdentityFor(source),
    snapshotTemplate(source),
    now,
    options,
  );
}

function assertInProgress(run: CheckRun): void {
  if (run.status !== "inProgress") {
    throw new DomainTransitionError(
      "runNotInProgress",
      "只有进行中的检查可以修改。",
    );
  }
}

function matchesItem(item: CheckRunItem, itemId: string): boolean {
  return item.runItemId === itemId || item.sourceItemId === itemId;
}

function updateItemState(
  run: CheckRun,
  itemId: string,
  state: CheckRunItemState,
  now: string,
): CheckRun {
  assertInProgress(run);
  let found = false;
  const items = run.items.map((item) => {
    if (!matchesItem(item, itemId)) return item;
    found = true;
    return { ...item, state };
  });
  if (!found) {
    throw new DomainTransitionError("itemNotFound", "找不到本次检查项。");
  }
  return { ...run, items, lastInteractedAt: now };
}

export function toggleConfirmed(
  run: CheckRun,
  itemId: string,
  now: string,
): CheckRun {
  const item = run.items.find((candidate) => matchesItem(candidate, itemId));
  if (!item) {
    throw new DomainTransitionError("itemNotFound", "找不到本次检查项。");
  }
  return updateItemState(
    run,
    itemId,
    item.state === "confirmed" ? "unchecked" : "confirmed",
    now,
  );
}

export function markNotNeeded(
  run: CheckRun,
  itemId: string,
  now: string,
): CheckRun {
  const item = run.items.find((candidate) => matchesItem(candidate, itemId));
  if (!item) {
    throw new DomainTransitionError("itemNotFound", "找不到本次检查项。");
  }
  return updateItemState(
    run,
    itemId,
    item.state === "notNeeded" ? "unchecked" : "notNeeded",
    now,
  );
}

export interface TemporaryItemInput {
  title: string;
  importance?: Importance;
  groupId?: string;
  condition?: string;
  hint?: string;
  oneTimeNote?: string;
}

export function addTemporaryItem(
  run: CheckRun,
  input: TemporaryItemInput,
  now: string,
  options: { runItemId?: string } = {},
): CheckRun {
  assertInProgress(run);
  const runItemId =
    options.runItemId ??
    deterministicId("temporary", now, `${run.checkRunId}:${input.title}`);
  const item: CheckRunItem = {
    runItemId,
    groupId: input.groupId ?? "temporary",
    title: input.title.trim(),
    importance: input.importance ?? "normal",
    ...(input.condition ? { condition: input.condition } : {}),
    ...(input.hint ? { hint: input.hint } : {}),
    ...(input.oneTimeNote ? { oneTimeNote: input.oneTimeNote } : {}),
    state: "unchecked",
    runSortOrder: run.items.length,
    isTemporary: true,
  };
  return {
    ...run,
    items: [...run.items, item],
    lastInteractedAt: now,
  };
}

export function setOneTimeNote(
  run: CheckRun,
  itemId: string,
  oneTimeNote: string | undefined,
  now: string,
): CheckRun {
  assertInProgress(run);
  let found = false;
  const items = run.items.map((item) => {
    if (!matchesItem(item, itemId)) return item;
    found = true;
    const { oneTimeNote: _previous, ...withoutNote } = item;
    return oneTimeNote
      ? { ...withoutNote, oneTimeNote }
      : withoutNote;
  });
  if (!found) {
    throw new DomainTransitionError("itemNotFound", "找不到本次检查项。");
  }
  return { ...run, items, lastInteractedAt: now };
}

export function reorderRunItems(
  run: CheckRun,
  orderedRunItemIds: readonly string[],
  now: string,
): CheckRun {
  assertInProgress(run);
  const expected = new Set(run.items.map((item) => item.runItemId));
  const received = new Set(orderedRunItemIds);
  if (
    received.size !== orderedRunItemIds.length ||
    received.size !== expected.size ||
    [...expected].some((id) => !received.has(id))
  ) {
    throw new DomainTransitionError(
      "invalidReorder",
      "排序必须且只能包含本次检查的全部项目。",
    );
  }
  const byId = new Map(run.items.map((item) => [item.runItemId, item]));
  return {
    ...run,
    items: orderedRunItemIds.map((runItemId, runSortOrder) => ({
      ...byId.get(runItemId)!,
      runSortOrder,
    })),
    lastInteractedAt: now,
  };
}

export function filterRunItems(
  run: CheckRun,
  view: RunItemView,
): CheckRunItem[] {
  const ordered = [...run.items].sort(
    (left, right) => left.runSortOrder - right.runSortOrder,
  );
  return view === "key"
    ? ordered.filter((item) => item.importance === "key")
    : ordered;
}

export function unresolvedCounts(run: CheckRun): {
  unresolvedCount: number;
  unresolvedKeyCount: number;
} {
  const unchecked = run.items.filter((item) => item.state === "unchecked");
  return {
    unresolvedCount: unchecked.length,
    unresolvedKeyCount: unchecked.filter((item) => item.importance === "key")
      .length,
  };
}

function closeAs(
  run: CheckRun,
  type: ClosedEvent["type"],
  now: string,
  closedEventId: string | undefined,
): CheckRun {
  const counts = unresolvedCounts(run);
  const event: ClosedEvent = {
    closedEventId:
      closedEventId ?? `${run.checkRunId}:closed:${run.closedEvents.length + 1}`,
    type,
    closedAt: now,
    ...counts,
  };
  return {
    ...run,
    status: type,
    lastInteractedAt: now,
    closedEvents: [...run.closedEvents, event],
  };
}

export function closeRun(
  run: CheckRun,
  options: CloseRunOptions,
): CloseRunResult {
  const counts = unresolvedCounts(run);
  if (run.status !== "inProgress") {
    return {
      kind: "rejected",
      reason: "runNotInProgress",
      ...counts,
    };
  }

  if (options.intent === "discard") {
    return {
      kind: "discarded",
      run: closeAs(run, "discarded", options.now, options.closedEventId),
    };
  }

  if (options.intent === "complete" && counts.unresolvedCount > 0) {
    return {
      kind: "rejected",
      reason: "uncheckedItemsRemain",
      ...counts,
    };
  }

  if (counts.unresolvedCount === 0) {
    return {
      kind: "completed",
      run: closeAs(run, "completed", options.now, options.closedEventId),
    };
  }

  if (counts.unresolvedKeyCount > 0 && options.keyRiskConfirmed !== true) {
    return { kind: "needsKeyConfirmation", ...counts };
  }

  return {
    kind: "endedWithUnresolved",
    run: closeAs(
      run,
      "endedWithUnresolved",
      options.now,
      options.closedEventId,
    ),
  };
}

export function reopenRun(run: CheckRun, now: string): ReopenRunResult {
  if (run.status !== "completed" && run.status !== "endedWithUnresolved") {
    return { kind: "unavailable", reason: "statusNotReopenable" };
  }
  const previousClose = run.closedEvents.at(-1);
  if (!previousClose) {
    return { kind: "unavailable", reason: "missingCloseEvent" };
  }
  const elapsed = Date.parse(now) - Date.parse(previousClose.closedAt);
  if (elapsed > PRODUCT_CONFIG.REOPEN_WINDOW_HOURS * 60 * 60 * 1000) {
    return { kind: "unavailable", reason: "windowExpired" };
  }
  return {
    kind: "reopened",
    run: {
      ...run,
      status: "inProgress",
      reopenCount: run.reopenCount + 1,
      lastReopenedAt: now,
      lastInteractedAt: now,
      closedEvents: [...run.closedEvents],
    },
  };
}

export function restartFromHistory(
  historyRun: CheckRun,
  now: string,
  options: Pick<StartRunOptions, "checkRunId"> = {},
): CheckRun {
  return startRunFromSnapshot(
    historyRun.sourceTemplateIdentity,
    historyRun.runTemplateSnapshot,
    now,
    options,
  );
}

export function isStaleCandidate(run: CheckRun, now: string): boolean {
  return (
    run.status === "inProgress" &&
    Date.parse(now) - Date.parse(run.lastInteractedAt) >=
      PRODUCT_CONFIG.STALE_AFTER_HOURS * 60 * 60 * 1000
  );
}
