import { describe, expect, it } from "vitest";

import {
  addTemporaryItem,
  buildRunClosureReceipt,
  closeRun,
  filterRunItems,
  markNotNeeded,
  reopenRun,
  reorderRunItems,
  restartFromHistory,
  startRun,
  toggleConfirmed,
} from "../src/run.js";
import {
  NOW,
  ONE_HOUR_LATER,
  THREE_HOURS_LATER,
  confirmEveryItem,
  officialTemplate,
  personalTemplate,
} from "./fixtures.js";

describe("CheckRun immutable behavior contract", () => {
  it("[RUN-001] keeps notNeeded local to one run and leaves the template untouched", () => {
    const template = officialTemplate("official.daily_out");
    const original = structuredClone(template);
    const runA = markNotNeeded(
      startRun(template, NOW, { checkRunId: "run-a" }),
      "daily.umbrella",
      ONE_HOUR_LATER,
    );
    const runB = startRun(template, THREE_HOURS_LATER, {
      checkRunId: "run-b",
    });

    expect(
      runA.items.find((item) => item.sourceItemId === "daily.umbrella")?.state,
    ).toBe("notNeeded");
    expect(
      runB.items.find((item) => item.sourceItemId === "daily.umbrella")?.state,
    ).toBe("unchecked");
    expect(template).toEqual(original);
  });

  it("[RUN-002] freezes a personal template snapshot when the run starts", () => {
    const template = personalTemplate();
    const run = startRun(template, NOW, { checkRunId: "run-snapshot" });
    const editedTemplate = structuredClone(template);
    editedTemplate.title = "后来改过的标题";
    editedTemplate.groups[0]!.items[0]!.title = "后来改过的手机标题";

    expect(run.runTemplateSnapshot.title).toBe("我的日常出门");
    expect(run.runTemplateSnapshot.groups[0]!.items[0]!.title).toBe("手机");
    expect(editedTemplate.title).not.toBe(run.runTemplateSnapshot.title);
  });

  it("[RUN-003] rejects normal completion while any item is unchecked", () => {
    const template = officialTemplate("official.daily_out");
    const initial = startRun(template, NOW, { checkRunId: "run-unresolved" });
    const partiallyHandled = toggleConfirmed(
      initial,
      initial.items[0]!.runItemId,
      ONE_HOUR_LATER,
    );

    const result = closeRun(partiallyHandled, {
      intent: "complete",
      now: THREE_HOURS_LATER,
      closedEventId: "close-rejected",
    });

    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.reason).toBe("uncheckedItemsRemain");
      expect(result.unresolvedCount).toBeGreaterThan(0);
    }
    expect(partiallyHandled.status).toBe("inProgress");
  });

  it("[RUN-004] requires a second confirmation before ending with unresolved key items", () => {
    const template = officialTemplate("official.daily_out");
    const run = startRun(template, NOW, { checkRunId: "run-key-risk" });

    const firstAttempt = closeRun(run, {
      intent: "endWithUnresolved",
      now: ONE_HOUR_LATER,
      closedEventId: "close-key-risk",
    });
    expect(firstAttempt).toMatchObject({
      kind: "needsKeyConfirmation",
      unresolvedKeyCount: 2,
    });

    const confirmedAttempt = closeRun(run, {
      intent: "endWithUnresolved",
      now: ONE_HOUR_LATER,
      keyRiskConfirmed: true,
      closedEventId: "close-key-risk",
    });
    expect(confirmedAttempt.kind).toBe("endedWithUnresolved");
    if (confirmedAttempt.kind === "endedWithUnresolved") {
      expect(confirmedAttempt.run.status).toBe("endedWithUnresolved");
      expect(confirmedAttempt.run.closedEvents).toHaveLength(1);
    }
  });

  it("[RUN-005] reopens inside the window without deleting the prior close event", () => {
    const template = officialTemplate("official.daily_out");
    const started = startRun(template, NOW, { checkRunId: "run-reopen" });
    const handled = confirmEveryItem(started, toggleConfirmed);
    const closed = closeRun(handled, {
      intent: "complete",
      now: ONE_HOUR_LATER,
      closedEventId: "close-1",
    });
    expect(closed.kind).toBe("completed");
    if (closed.kind !== "completed") return;

    const reopened = reopenRun(closed.run, "2026-09-01T10:59:59.000+08:00");
    expect(reopened.kind).toBe("reopened");
    if (reopened.kind === "reopened") {
      expect(reopened.run.status).toBe("inProgress");
      expect(reopened.run.reopenCount).toBe(1);
      expect(reopened.run.closedEvents).toEqual(closed.run.closedEvents);
    }
  });

  it("[RUN-006] makes expiry explicit and creates a distinct run from history", () => {
    const template = officialTemplate("official.daily_out");
    const started = startRun(template, NOW, { checkRunId: "run-old" });
    const handled = confirmEveryItem(started, toggleConfirmed);
    const closed = closeRun(handled, {
      intent: "complete",
      now: ONE_HOUR_LATER,
      closedEventId: "close-old",
    });
    expect(closed.kind).toBe("completed");
    if (closed.kind !== "completed") return;

    const unavailable = reopenRun(closed.run, "2026-09-01T11:00:01.000+08:00");
    expect(unavailable).toEqual({ kind: "unavailable", reason: "windowExpired" });

    const restarted = restartFromHistory(closed.run, THREE_HOURS_LATER, {
      checkRunId: "run-new",
    });
    expect(restarted.checkRunId).toBe("run-new");
    expect(restarted.checkRunId).not.toBe(closed.run.checkRunId);
    expect(restarted.status).toBe("inProgress");
    expect(restarted.items.every((item) => item.state === "unchecked")).toBe(true);
  });

  it("[RUN-007] key-only projection never changes completion calculation", () => {
    const template = officialTemplate("official.daily_out");
    const initial = startRun(template, NOW, { checkRunId: "run-key-filter" });
    const keyHandled = initial.items
      .filter((item) => item.importance === "key")
      .reduce(
        (current, item) => toggleConfirmed(current, item.runItemId, ONE_HOUR_LATER),
        initial,
      );

    expect(filterRunItems(keyHandled, "key").every((item) => item.state === "confirmed")).toBe(true);
    expect(
      closeRun(keyHandled, {
        intent: "complete",
        now: THREE_HOURS_LATER,
        closedEventId: "close-filter",
      }).kind,
    ).toBe("rejected");
  });

  it("[RUN-008] preserves separate identities for simultaneous runs from one template", () => {
    const template = officialTemplate("official.international_travel");
    const first = startRun(template, NOW, { checkRunId: "trip-a" });
    const second = startRun(template, ONE_HOUR_LATER, { checkRunId: "trip-b" });

    expect(first.sourceTemplateIdentity).toEqual(second.sourceTemplateIdentity);
    expect(first.checkRunId).not.toBe(second.checkRunId);
    expect(first.items[0]!.runItemId).not.toBe(second.items[0]!.runItemId);
  });

  it("projects frozen completion and unresolved receipts from persisted run facts", () => {
    const template = officialTemplate("official.daily_out");
    const started = startRun(template, NOW, { checkRunId: "run-receipt" });
    expect(buildRunClosureReceipt(started)).toBeUndefined();

    const completed = closeRun(confirmEveryItem(started, toggleConfirmed), {
      intent: "complete",
      now: ONE_HOUR_LATER,
      closedEventId: "close-receipt-completed",
    });
    expect(completed.kind).toBe("completed");
    if (completed.kind !== "completed") return;
    expect(buildRunClosureReceipt(completed.run)).toEqual({
      kind: "completed",
      title: "这份清单已全部处理",
      message: "可以放心出发。",
    });

    const unresolved = closeRun(started, {
      intent: "endWithUnresolved",
      keyRiskConfirmed: true,
      now: ONE_HOUR_LATER,
      closedEventId: "close-receipt-unresolved",
    });
    expect(unresolved.kind).toBe("endedWithUnresolved");
    if (unresolved.kind !== "endedWithUnresolved") return;
    const lastClose = unresolved.run.closedEvents.at(-1)!;
    expect(buildRunClosureReceipt(unresolved.run)).toEqual({
      kind: "endedWithUnresolved",
      title: "本次检查已结束",
      message: `仍有${lastClose.unresolvedCount}项未确认，其中${lastClose.unresolvedKeyCount}项为关键项。`,
    });
  });

  it("supports explicit temporary items, note-safe state toggling, and immutable reorder", () => {
    const template = officialTemplate("official.daily_out");
    const initial = startRun(template, NOW, { checkRunId: "run-edit" });
    const withTemporary = addTemporaryItem(
      initial,
      { title: "门窗复查", importance: "key", oneTimeNote: "仅今天" },
      ONE_HOUR_LATER,
      { runItemId: "temporary-1" },
    );
    const reversedIds = withTemporary.items.map((item) => item.runItemId).reverse();
    const reordered = reorderRunItems(withTemporary, reversedIds, THREE_HOURS_LATER);

    expect(initial.items).toHaveLength(template.groups.flatMap((group) => group.items).length);
    expect(withTemporary.items.at(-1)).toMatchObject({
      runItemId: "temporary-1",
      isTemporary: true,
      state: "unchecked",
    });
    expect(reordered.items.map((item) => item.runItemId)).toEqual(reversedIds);
    expect(withTemporary.items.map((item) => item.runItemId)).not.toEqual(reversedIds);
  });
});
