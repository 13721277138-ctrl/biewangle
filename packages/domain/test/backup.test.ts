import { describe, expect, it } from "vitest";

import {
  BackupValidationError,
  exportBackup,
  parseAndValidateBackup,
  serializeBackup,
  validateBusinessInvariants,
} from "../src/backup.js";
import { createPlannedCheck } from "../src/plan.js";
import { closeRun, reopenRun, startRun, toggleConfirmed } from "../src/run.js";
import { appSnapshot, SNAPSHOT_NOW } from "./app-fixtures.js";
import { officialTemplate } from "./fixtures.js";

describe("Backup Envelope and restore candidate validation", () => {
  it("exports and parses the shared V1 envelope without changing the snapshot", () => {
    const snapshot = appSnapshot();
    const original = structuredClone(snapshot);
    const envelope = exportBackup(snapshot, "pwa", SNAPSHOT_NOW);
    const serialized = serializeBackup(envelope);

    expect(envelope).toMatchObject({
      productId: "biewangle",
      appVersion: "1.1.0",
      schemaVersion: 1,
      backupFormatVersion: 1,
      sourcePlatform: "pwa",
      officialContentVersion: 1,
      exportedAt: SNAPSHOT_NOW,
    });
    expect(parseAndValidateBackup(serialized)).toEqual(envelope);
    expect(snapshot).toEqual(original);
    expect(serialized.endsWith("\n")).toBe(true);
  });

  it.each([
    ["损坏 JSON", "{", "invalidJson"],
    [
      "错误产品",
      JSON.stringify({
        ...exportBackup(appSnapshot(), "pwa", SNAPSHOT_NOW),
        productId: "another-product",
      }),
      "productMismatch",
    ],
    [
      "未来备份格式",
      JSON.stringify({
        ...exportBackup(appSnapshot(), "pwa", SNAPSHOT_NOW),
        backupFormatVersion: 2,
      }),
      "unsupportedBackupFormatVersion",
    ],
    [
      "未来数据结构",
      JSON.stringify({
        ...exportBackup(appSnapshot(), "pwa", SNAPSHOT_NOW),
        schemaVersion: 2,
      }),
      "unsupportedSchemaVersion",
    ],
  ])("rejects %s with a stable visible code", (_title, raw, expectedCode) => {
    expect(() => parseAndValidateBackup(raw)).toThrow(BackupValidationError);
    try {
      parseAndValidateBackup(raw);
    } catch (error) {
      expect(error).toMatchObject({ code: expectedCode });
    }
  });

  it("rejects business-invalid duplicates even when the JSON schema shape is valid", () => {
    const template = {
      personalTemplateId: "personal-duplicate",
      title: "个人模板",
      groups: [
        {
          groupId: "group",
          title: "分组",
          items: [
            { itemId: "same", title: "A", importance: "normal" as const },
            { itemId: "same", title: "B", importance: "normal" as const },
          ],
        },
      ],
      createdAt: SNAPSHOT_NOW,
      updatedAt: SNAPSHOT_NOW,
    };
    const candidate = appSnapshot({ personalTemplates: [template] });

    expect(() => validateBusinessInvariants(candidate)).toThrowError(
      expect.objectContaining({ code: "businessInvariantViolation" }),
    );
  });

  it.each([
    ["changes frozen item content", (run: ReturnType<typeof startRun>) => {
      run.items[0]!.title = "被改写的历史项";
    }],
    ["drops a frozen source item", (run: ReturnType<typeof startRun>) => {
      run.items.splice(0, 1);
      run.items.forEach((item, index) => {
        item.runSortOrder = index;
      });
    }],
    ["marks a sourced item as temporary", (run: ReturnType<typeof startRun>) => {
      run.items[0]!.isTemporary = true;
    }],
  ])("rejects a run that %s", (_description, mutate) => {
    const run = startRun(officialTemplate("official.daily_out"), SNAPSHOT_NOW, {
      checkRunId: "run-snapshot-integrity",
    });
    mutate(run);

    expect(() =>
      validateBusinessInvariants(appSnapshot({ checkRuns: [run] })),
    ).toThrowError(expect.objectContaining({ code: "businessInvariantViolation" }));
  });

  it("rejects a consumed plan linked to a run created from a different frozen snapshot", () => {
    const plan = createPlannedCheck(officialTemplate("official.hotel_checkout"), {
      plannedCheckId: "plan-mismatched-snapshot",
      scheduledDate: "2026-09-05",
      createdTimeZoneId: "Asia/Shanghai",
      now: SNAPSHOT_NOW,
    });
    const run = startRun(
      officialTemplate("official.daily_out"),
      "2026-09-01T09:05:00.000+08:00",
      {
        checkRunId: "run-mismatched-snapshot",
        sourcePlannedCheckId: plan.plannedCheckId,
      },
    );
    const consumedPlan = {
      ...plan,
      status: "consumed" as const,
      startedCheckRunId: run.checkRunId,
    };

    expect(() =>
      validateBusinessInvariants(
        appSnapshot({ plannedChecks: [consumedPlan], checkRuns: [run] }),
      ),
    ).toThrowError(expect.objectContaining({ code: "businessInvariantViolation" }));
  });

  it.each([
    ["has a close event without a matching reopen", (run: ReturnType<typeof startRun>) => {
      run.closedEvents.push({
        closedEventId: "closed-impossible-lineage",
        type: "endedWithUnresolved",
        closedAt: "2026-09-01T09:05:00.000+08:00",
        unresolvedCount: run.items.length,
        unresolvedKeyCount: run.items.filter((item) => item.importance === "key").length,
      });
    }],
    ["claims a reopen timestamp while reopenCount is zero", (run: ReturnType<typeof startRun>) => {
      run.lastReopenedAt = "2026-09-01T09:05:00.000+08:00";
    }],
    ["has more close events than its reopen lineage permits", (run: ReturnType<typeof startRun>) => {
      const discarded = closeRun(run, {
        intent: "discard",
        now: "2026-09-01T09:05:00.000+08:00",
        closedEventId: "closed-first",
      });
      if (discarded.kind !== "discarded") throw new Error("fixture did not close");
      Object.assign(run, discarded.run);
      run.closedEvents.push({
        ...run.closedEvents[0]!,
        closedEventId: "closed-impossible-second",
      });
    }],
    ["claims it reopened after a terminal discard", (run: ReturnType<typeof startRun>) => {
      const discarded = closeRun(run, {
        intent: "discard",
        now: "2026-09-01T09:05:00.000+08:00",
        closedEventId: "closed-terminal-discard",
      });
      if (discarded.kind !== "discarded") throw new Error("fixture did not close");
      Object.assign(run, discarded.run, {
        status: "inProgress",
        reopenCount: 1,
        lastReopenedAt: "2026-09-01T09:06:00.000+08:00",
      });
    }],
    ["retains an internally impossible prior close fact", (run: ReturnType<typeof startRun>) => {
      run.closedEvents.push({
        closedEventId: "closed-impossible-completed-count",
        type: "completed",
        closedAt: "2026-09-01T09:05:00.000+08:00",
        unresolvedCount: 1,
        unresolvedKeyCount: 2,
      });
      run.reopenCount = 1;
      run.lastReopenedAt = "2026-09-01T09:06:00.000+08:00";
    }],
  ])("rejects a run that %s", (_description, mutate) => {
    const run = startRun(officialTemplate("official.daily_out"), SNAPSHOT_NOW, {
      checkRunId: "run-event-lineage",
    });
    mutate(run);

    expect(() =>
      validateBusinessInvariants(appSnapshot({ checkRuns: [run] })),
    ).toThrowError(expect.objectContaining({ code: "businessInvariantViolation" }));
  });

  it("accepts a real close, reopen, then terminal-discard lineage", () => {
    const started = startRun(officialTemplate("official.daily_out"), SNAPSHOT_NOW, {
      checkRunId: "run-valid-reopen-lineage",
    });
    const handled = started.items.reduce(
      (run, item) => toggleConfirmed(run, item.runItemId, SNAPSHOT_NOW),
      started,
    );
    const completed = closeRun(handled, {
      intent: "complete",
      now: "2026-09-01T09:05:00.000+08:00",
      closedEventId: "closed-valid-first",
    });
    if (completed.kind !== "completed") throw new Error("fixture did not close");
    const reopened = reopenRun(completed.run, "2026-09-01T09:06:00.000+08:00");
    if (reopened.kind !== "reopened") throw new Error("fixture did not reopen");
    const discarded = closeRun(reopened.run, {
      intent: "discard",
      now: "2026-09-01T09:07:00.000+08:00",
      closedEventId: "closed-valid-discard",
    });
    if (discarded.kind !== "discarded") throw new Error("fixture did not discard");
    const snapshot = appSnapshot({ checkRuns: [discarded.run] });

    expect(validateBusinessInvariants(snapshot)).toEqual(snapshot);
  });
});
