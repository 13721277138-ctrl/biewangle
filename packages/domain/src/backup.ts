import {
  AppSnapshotSchema,
  BackupEnvelopeSchema,
  type AppSnapshot,
  type BackupEnvelope,
  type CheckRun,
  type SourcePlatform,
  type TemplateSnapshot,
} from "./schema.js";

export const BACKUP_FORMAT_VERSION = 1 as const;
export const CURRENT_SCHEMA_VERSION = 1 as const;

export type BackupValidationErrorCode =
  | "invalidJson"
  | "invalidEnvelope"
  | "productMismatch"
  | "unsupportedBackupFormatVersion"
  | "unsupportedSchemaVersion"
  | "businessInvariantViolation";

export class BackupValidationError extends Error {
  constructor(
    public readonly code: BackupValidationErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "BackupValidationError";
  }
}

export function exportBackup(
  snapshot: AppSnapshot,
  sourcePlatform: SourcePlatform,
  exportedAt: string,
): BackupEnvelope {
  const data = validateBusinessInvariants(snapshot);
  return BackupEnvelopeSchema.parse({
    productId: "biewangle",
    appVersion: data.appVersion,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    sourcePlatform,
    officialContentVersion: data.officialContentVersion,
    exportedAt,
    data,
  });
}

export function serializeBackup(envelope: BackupEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertUnique(
  values: readonly string[],
  description: string,
): void {
  if (new Set(values).size !== values.length) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      `${description}存在重复标识。`,
    );
  }
}

function validateTemplateSnapshot(
  snapshot: TemplateSnapshot,
  description: string,
): void {
  assertUnique(
    snapshot.groups.map((group) => group.groupId),
    `${description}分组`,
  );
  assertUnique(
    snapshot.groups.flatMap((group) =>
      group.items.map((item) => item.itemId),
    ),
    `${description}项目`,
  );
}

function validateClosedRun(run: CheckRun): void {
  if (run.status === "inProgress") return;
  const lastClose = run.closedEvents.at(-1);
  if (!lastClose || lastClose.type !== run.status) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      `检查 ${run.checkRunId} 的关闭状态与关闭事件不一致。`,
    );
  }
  const unresolved = run.items.filter((item) => item.state === "unchecked");
  const unresolvedKey = unresolved.filter(
    (item) => item.importance === "key",
  );
  if (
    lastClose.unresolvedCount !== unresolved.length ||
    lastClose.unresolvedKeyCount !== unresolvedKey.length
  ) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      `检查 ${run.checkRunId} 的未处理计数与项目事实不一致。`,
    );
  }
  if (run.status === "completed" && unresolved.length !== 0) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      `检查 ${run.checkRunId} 仍有未处理项却标记为完成。`,
    );
  }
  if (run.status === "endedWithUnresolved" && unresolved.length === 0) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      `检查 ${run.checkRunId} 没有未处理项却标记为未解决结束。`,
    );
  }
}

function validateRunSnapshotItems(run: CheckRun): void {
  const frozenItems = run.runTemplateSnapshot.groups.flatMap((group) =>
    group.items.map((item) => ({ groupId: group.groupId, item })),
  );
  const frozenById = new Map(
    frozenItems.map((entry) => [entry.item.itemId, entry]),
  );
  const sourcedItems = run.items.filter((item) => !item.isTemporary);

  if (sourcedItems.length !== frozenItems.length) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      `检查 ${run.checkRunId} 的运行项与冻结快照数量不一致。`,
    );
  }

  for (const runItem of run.items) {
    if (runItem.isTemporary) {
      if (runItem.sourceItemId !== undefined) {
        throw new BackupValidationError(
          "businessInvariantViolation",
          `检查 ${run.checkRunId} 的临时项不应声称冻结来源。`,
        );
      }
      continue;
    }

    const sourceItemId = runItem.sourceItemId;
    const frozen = sourceItemId ? frozenById.get(sourceItemId) : undefined;
    if (
      !sourceItemId ||
      !frozen ||
      runItem.runItemId !== `${run.checkRunId}:${sourceItemId}` ||
      runItem.groupId !== frozen.groupId ||
      runItem.title !== frozen.item.title ||
      runItem.importance !== frozen.item.importance ||
      runItem.condition !== frozen.item.condition ||
      runItem.hint !== frozen.item.hint
    ) {
      throw new BackupValidationError(
        "businessInvariantViolation",
        `检查 ${run.checkRunId} 的运行项与冻结快照不一致。`,
      );
    }
  }
}

function factsMatch(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => factsMatch(entry, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) && factsMatch(left[key], right[key]),
    )
  );
}

function validateRunEventLineage(run: CheckRun): void {
  const expectedCloseCount =
    run.status === "inProgress" ? run.reopenCount : run.reopenCount + 1;
  const hasReopenedAt = run.lastReopenedAt !== undefined;
  const priorCloseEvents =
    run.status === "inProgress"
      ? run.closedEvents
      : run.closedEvents.slice(0, -1);
  const hasImpossibleCloseFact = run.closedEvents.some(
    (event) =>
      event.unresolvedKeyCount > event.unresolvedCount ||
      (event.type === "completed" && event.unresolvedCount !== 0) ||
      (event.type === "endedWithUnresolved" &&
        event.unresolvedCount === 0),
  );

  if (
    run.closedEvents.length !== expectedCloseCount ||
    hasReopenedAt !== (run.reopenCount > 0) ||
    priorCloseEvents.some((event) => event.type === "discarded") ||
    hasImpossibleCloseFact
  ) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      `检查 ${run.checkRunId} 的关闭与重开事件链不一致。`,
    );
  }
}

export function validateBusinessInvariants(
  candidate: AppSnapshot,
): AppSnapshot {
  let snapshot: AppSnapshot;
  try {
    snapshot = AppSnapshotSchema.parse(candidate);
  } catch (error) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      "数据结构不符合当前应用事实合同。",
      { cause: error },
    );
  }

  assertUnique(
    snapshot.personalTemplates.map((template) => template.personalTemplateId),
    "个人模板",
  );
  assertUnique(
    snapshot.plannedChecks.map((plan) => plan.plannedCheckId),
    "计划",
  );
  assertUnique(
    snapshot.checkRuns.map((run) => run.checkRunId),
    "检查运行",
  );

  for (const template of snapshot.personalTemplates) {
    validateTemplateSnapshot(
      { title: template.title, groups: template.groups },
      `个人模板 ${template.personalTemplateId} 的`,
    );
  }
  for (const plan of snapshot.plannedChecks) {
    validateTemplateSnapshot(
      plan.plannedTemplateSnapshot,
      `计划 ${plan.plannedCheckId} 的快照`,
    );
  }
  const plansById = new Map(
    snapshot.plannedChecks.map((plan) => [plan.plannedCheckId, plan]),
  );
  const runsById = new Map(
    snapshot.checkRuns.map((run) => [run.checkRunId, run]),
  );
  for (const run of snapshot.checkRuns) {
    validateTemplateSnapshot(
      run.runTemplateSnapshot,
      `检查 ${run.checkRunId} 的快照`,
    );
    assertUnique(
      run.items.map((item) => item.runItemId),
      `检查 ${run.checkRunId} 的运行项目`,
    );
    assertUnique(
      run.items.flatMap((item) =>
        item.sourceItemId === undefined ? [] : [item.sourceItemId],
      ),
      `检查 ${run.checkRunId} 的来源项目`,
    );
    validateRunSnapshotItems(run);
    assertUnique(
      run.items.map((item) => String(item.runSortOrder)),
      `检查 ${run.checkRunId} 的排序`,
    );
    const runSortOrders = run.items
      .map((item) => item.runSortOrder)
      .sort((left, right) => left - right);
    if (runSortOrders.some((order, index) => order !== index)) {
      throw new BackupValidationError(
        "businessInvariantViolation",
        `检查 ${run.checkRunId} 的排序不是连续序列。`,
      );
    }
    assertUnique(
      run.closedEvents.map((event) => event.closedEventId),
      `检查 ${run.checkRunId} 的关闭事件`,
    );
    validateRunEventLineage(run);
    validateClosedRun(run);
    if (run.sourcePlannedCheckId) {
      const sourcePlan = plansById.get(run.sourcePlannedCheckId);
      if (
        !sourcePlan ||
        sourcePlan.startedCheckRunId !== run.checkRunId ||
        !factsMatch(
          sourcePlan.sourceTemplateIdentity,
          run.sourceTemplateIdentity,
        ) ||
        !factsMatch(
          sourcePlan.plannedTemplateSnapshot,
          run.runTemplateSnapshot,
        )
      ) {
        throw new BackupValidationError(
          "businessInvariantViolation",
          `检查 ${run.checkRunId} 与来源计划的引用或冻结事实不一致。`,
        );
      }
    }
  }
  for (const plan of snapshot.plannedChecks) {
    if (plan.status === "consumed") {
      const run = plan.startedCheckRunId
        ? runsById.get(plan.startedCheckRunId)
        : undefined;
      if (!run || run.sourcePlannedCheckId !== plan.plannedCheckId) {
        throw new BackupValidationError(
          "businessInvariantViolation",
          `已消费计划 ${plan.plannedCheckId} 没有对应的检查运行。`,
        );
      }
    } else if (plan.startedCheckRunId !== undefined) {
      throw new BackupValidationError(
        "businessInvariantViolation",
        `未消费计划 ${plan.plannedCheckId} 不应绑定检查运行。`,
      );
    }
  }

  assertUnique(snapshot.settings.favoriteTemplateIds, "收藏模板");
  assertUnique(snapshot.settings.hiddenOfficialTemplateIds, "隐藏官方模板");

  return structuredClone(snapshot);
}

export function parseAndValidateBackup(raw: string): BackupEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new BackupValidationError(
      "invalidJson",
      "备份文件不是有效 JSON。",
      { cause: error },
    );
  }
  if (!isRecord(parsed)) {
    throw new BackupValidationError(
      "invalidEnvelope",
      "备份文件缺少有效的外层结构。",
    );
  }
  if (parsed.productId !== "biewangle") {
    throw new BackupValidationError(
      "productMismatch",
      "该文件不是“别忘了”备份。",
    );
  }
  if (parsed.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupValidationError(
      "unsupportedBackupFormatVersion",
      `不支持的备份格式版本：${String(parsed.backupFormatVersion)}。`,
    );
  }
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new BackupValidationError(
      "unsupportedSchemaVersion",
      `不支持的数据结构版本：${String(parsed.schemaVersion)}。`,
    );
  }

  let envelope: BackupEnvelope;
  try {
    envelope = BackupEnvelopeSchema.parse(parsed);
  } catch (error) {
    throw new BackupValidationError(
      "invalidEnvelope",
      "备份字段不完整或格式错误。",
      { cause: error },
    );
  }
  if (
    envelope.data.schemaVersion !== envelope.schemaVersion ||
    envelope.data.appVersion !== envelope.appVersion ||
    envelope.data.officialContentVersion !== envelope.officialContentVersion
  ) {
    throw new BackupValidationError(
      "businessInvariantViolation",
      "备份头部版本与数据内容不一致。",
    );
  }
  return {
    ...envelope,
    data: validateBusinessInvariants(envelope.data),
  };
}
