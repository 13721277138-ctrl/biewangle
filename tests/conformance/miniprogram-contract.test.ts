import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  addTemporaryItem,
  buildRunClosureReceipt,
  buildReadableExport,
  cancelPlannedCheck,
  closeRun,
  createPlannedCheck,
  exportBackup,
  markNotNeeded,
  parseAndValidateBackup,
  reopenRun,
  setOneTimeNote,
  startPlannedCheck,
  startRun,
  toggleConfirmed,
  validateBusinessInvariants,
} from "../../packages/domain/src/index";
import type { AppSnapshot, OfficialTemplate } from "../../packages/domain/src/index";
import { appSnapshot } from "../../packages/domain/test/app-fixtures";

const require = createRequire(import.meta.url);

function nativeDomain(): {
  addTemporaryItem: typeof addTemporaryItem;
  buildRunClosureReceipt: typeof buildRunClosureReceipt;
  buildReadableExport: typeof buildReadableExport;
  cancelPlannedCheck: typeof cancelPlannedCheck;
  closeRun: typeof closeRun;
  createPlannedCheck: typeof createPlannedCheck;
  exportBackup: typeof exportBackup;
  markNotNeeded: typeof markNotNeeded;
  parseAndValidateBackup: typeof parseAndValidateBackup;
  reopenRun: typeof reopenRun;
  setOneTimeNote: typeof setOneTimeNote;
  startPlannedCheck: typeof startPlannedCheck;
  startRun: typeof startRun;
  toggleConfirmed: typeof toggleConfirmed;
  validateSnapshot: typeof validateBusinessInvariants;
} {
  return require("../../miniprogram/lib/domain.js");
}

function nativeTemplates(): OfficialTemplate[] {
  return require("../../miniprogram/generated/official-templates.js").templates;
}

const NOW = "2026-09-01T08:00:00.000+08:00";
const LATER = "2026-09-01T08:05:00.000+08:00";
const VERTICAL_TEMPLATE_IDS = [
  "official.daily_out",
  "official.hotel_checkout",
  "official.international_travel",
  "official.important_medical_visit",
] as const;

describe("native WeChat conformance", () => {
  it("ships the same four representative official fixtures with stable identities", () => {
    const templates = nativeTemplates();
    const ids = [
      "official.daily_out",
      "official.hotel_checkout",
      "official.international_travel",
      "official.important_medical_visit",
    ];

    expect(templates.filter((template) => ids.includes(template.templateId))).toHaveLength(4);
    expect(templates.find((template) => template.templateId === "official.daily_out")?.groups[0]?.items[0]?.itemId)
      .toBe("daily.phone");
  });

  it("produces the same run snapshots and state transitions as the shared domain", () => {
    const native = nativeDomain();
    const template = nativeTemplates().find(
      (candidate) => candidate.templateId === "official.daily_out",
    )!;
    const options = { checkRunId: "run.native-contract" };

    const sharedStarted = startRun(template, NOW, options);
    const nativeStarted = native.startRun(template as never, NOW as never, options as never);
    expect(nativeStarted).toEqual(sharedStarted);

    const sharedUpdated = addTemporaryItem(
      markNotNeeded(toggleConfirmed(sharedStarted, "daily.phone", LATER), "daily.umbrella", LATER),
      { title: "门窗复核", importance: "key" },
      LATER,
      { runItemId: "temporary.native-contract" },
    );
    const nativeUpdated = native.addTemporaryItem(
      native.markNotNeeded(
        native.toggleConfirmed(nativeStarted as never, "daily.phone" as never, LATER as never) as never,
        "daily.umbrella" as never,
        LATER as never,
      ) as never,
      { title: "门窗复核", importance: "key" } as never,
      LATER as never,
      { runItemId: "temporary.native-contract" } as never,
    );
    expect(nativeUpdated).toEqual(sharedUpdated);

    const sharedClose = closeRun(sharedUpdated, { intent: "endWithUnresolved", now: LATER });
    const nativeClose = native.closeRun(
      nativeUpdated as never,
      { intent: "endWithUnresolved", now: LATER } as never,
    );
    expect(nativeClose).toEqual(sharedClose);
    expect(nativeClose).toMatchObject({ kind: "needsKeyConfirmation" });

    const sharedConfirmedClose = closeRun(sharedUpdated, {
      intent: "endWithUnresolved",
      keyRiskConfirmed: true,
      now: LATER,
      closedEventId: "closed.native-contract",
    });
    const nativeConfirmedClose = native.closeRun(
      nativeUpdated as never,
      {
        intent: "endWithUnresolved",
        keyRiskConfirmed: true,
        now: LATER,
        closedEventId: "closed.native-contract",
      } as never,
    );
    expect(nativeConfirmedClose).toEqual(sharedConfirmedClose);
    expect(nativeConfirmedClose).toMatchObject({ kind: "endedWithUnresolved" });
  });

  it("derives the same default temporary-item identity from normalized input", () => {
    const native = nativeDomain();
    const template = nativeTemplates().find(
      (candidate) => candidate.templateId === "official.daily_out",
    )!;
    const sharedRun = startRun(template, NOW, { checkRunId: "run.default-temp-id" });
    const nativeRun = native.startRun(template, NOW, { checkRunId: "run.default-temp-id" });
    const input = { title: "  门窗复核  ", importance: "key" as const };

    expect(native.addTemporaryItem(nativeRun, input, LATER)).toEqual(
      addTemporaryItem(sharedRun, input, LATER),
    );
  });

  it.each(VERTICAL_TEMPLATE_IDS)(
    "keeps every lifecycle fact byte-equivalent for %s",
    (templateId) => {
      const native = nativeDomain();
      const template = nativeTemplates().find((candidate) => candidate.templateId === templateId)!;
      const checkRunId = `run.audit.${templateId}`;
      let sharedRun = startRun(template, NOW, { checkRunId });
      let nativeRun = native.startRun(template, NOW, { checkRunId });
      expect(nativeRun).toEqual(sharedRun);

      const first = sharedRun.items[0]!;
      const second = sharedRun.items[1]!;
      sharedRun = toggleConfirmed(sharedRun, first.runItemId, LATER);
      nativeRun = native.toggleConfirmed(nativeRun, first.runItemId, LATER);
      expect(nativeRun).toEqual(sharedRun);

      sharedRun = markNotNeeded(sharedRun, second.runItemId, LATER);
      nativeRun = native.markNotNeeded(nativeRun, second.runItemId, LATER);
      expect(nativeRun).toEqual(sharedRun);

      sharedRun = setOneTimeNote(sharedRun, first.runItemId, "只属于本次，不进入默认分享", LATER);
      nativeRun = native.setOneTimeNote(nativeRun, first.runItemId, "只属于本次，不进入默认分享", LATER);
      expect(nativeRun).toEqual(sharedRun);

      const temporaryInput = {
        title: "  临时语义复核  ",
        importance: "key" as const,
        groupId: "temporary.audit",
        condition: "仅本次",
        hint: "不应写回模板",
        oneTimeNote: "私密",
      };
      const temporaryOptions = { runItemId: `temporary.audit.${templateId}` };
      sharedRun = addTemporaryItem(sharedRun, temporaryInput, LATER, temporaryOptions);
      nativeRun = native.addTemporaryItem(nativeRun, temporaryInput, LATER, temporaryOptions);
      expect(nativeRun).toEqual(sharedRun);

      const rejectedOptions = {
        intent: "complete" as const,
        now: LATER,
        closedEventId: `closed.rejected.${templateId}`,
      };
      expect(native.closeRun(nativeRun, rejectedOptions)).toEqual(closeRun(sharedRun, rejectedOptions));

      const unresolvedOptions = {
        intent: "endWithUnresolved" as const,
        now: LATER,
        closedEventId: `closed.unresolved.${templateId}`,
      };
      expect(native.closeRun(nativeRun, unresolvedOptions)).toEqual(closeRun(sharedRun, unresolvedOptions));

      for (const item of sharedRun.items.filter((candidate) => candidate.state === "unchecked")) {
        sharedRun = toggleConfirmed(sharedRun, item.runItemId, LATER);
        nativeRun = native.toggleConfirmed(nativeRun, item.runItemId, LATER);
      }
      expect(nativeRun).toEqual(sharedRun);

      const completeOptions = {
        intent: "complete" as const,
        now: LATER,
        closedEventId: `closed.complete.${templateId}`,
      };
      const sharedCompleted = closeRun(sharedRun, completeOptions);
      const nativeCompleted = native.closeRun(nativeRun, completeOptions);
      expect(nativeCompleted).toEqual(sharedCompleted);
      expect(sharedCompleted.kind).toBe("completed");
      if (sharedCompleted.kind !== "completed" || nativeCompleted.kind !== "completed") return;

      expect(native.reopenRun(nativeCompleted.run, "2026-09-01T10:04:59.999+08:00")).toEqual(
        reopenRun(sharedCompleted.run, "2026-09-01T10:04:59.999+08:00"),
      );
      expect(native.reopenRun(nativeCompleted.run, "2026-09-01T10:05:00.001+08:00")).toEqual(
        reopenRun(sharedCompleted.run, "2026-09-01T10:05:00.001+08:00"),
      );

      const freshShared = startRun(template, NOW, { checkRunId: `${checkRunId}.discard` });
      const freshNative = native.startRun(template, NOW, { checkRunId: `${checkRunId}.discard` });
      const discardOptions = {
        intent: "discard" as const,
        now: LATER,
        closedEventId: `closed.discard.${templateId}`,
      };
      expect(native.closeRun(freshNative, discardOptions)).toEqual(
        closeRun(freshShared, discardOptions),
      );
    },
  );

  it("freezes the same planned template snapshot", () => {
    const native = nativeDomain();
    const template = nativeTemplates().find(
      (candidate) => candidate.templateId === "official.hotel_checkout",
    )!;
    const options = {
      plannedCheckId: "plan.native-contract",
      scheduledDate: "2026-09-05",
      scheduledTime: "09:30",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    };

    const sharedPlan = createPlannedCheck(template, options);
    const nativePlan = native.createPlannedCheck(template as never, options as never);
    expect(nativePlan).toEqual(sharedPlan);

    const startOptions = { checkRunId: "run.planned-native-contract" };
    expect(native.startPlannedCheck(nativePlan as never, LATER as never, startOptions as never)).toEqual(
      startPlannedCheck(sharedPlan, LATER, startOptions),
    );
  });

  it("projects the same persisted closure receipts with frozen copy", () => {
    const native = nativeDomain();
    const template = nativeTemplates().find(
      (candidate) => candidate.templateId === "official.daily_out",
    )!;
    const started = startRun(template, NOW, { checkRunId: "run.receipt-contract" });
    expect(native.buildRunClosureReceipt(started)).toEqual(buildRunClosureReceipt(started));

    const completed = closeRun(
      started.items.reduce(
        (run, item) => toggleConfirmed(run, item.runItemId, LATER),
        started,
      ),
      {
        intent: "complete",
        now: LATER,
        closedEventId: "closed.receipt-contract",
      },
    );
    expect(completed.kind).toBe("completed");
    if (completed.kind !== "completed") return;
    expect(native.buildRunClosureReceipt(completed.run)).toEqual(
      buildRunClosureReceipt(completed.run),
    );

    const unresolved = closeRun(started, {
      intent: "endWithUnresolved",
      keyRiskConfirmed: true,
      now: LATER,
      closedEventId: "closed.unresolved-receipt-contract",
    });
    expect(unresolved.kind).toBe("endedWithUnresolved");
    if (unresolved.kind !== "endedWithUnresolved") return;
    expect(native.buildRunClosureReceipt(unresolved.run)).toEqual(
      buildRunClosureReceipt(unresolved.run),
    );
  });

  it.each(VERTICAL_TEMPLATE_IDS)("keeps plan create, consume and cancel facts equal for %s", (templateId) => {
    const native = nativeDomain();
    const template = nativeTemplates().find((candidate) => candidate.templateId === templateId)!;
    const options = {
      plannedCheckId: `plan.audit.${templateId}`,
      scheduledDate: "2026-09-05",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    };
    const sharedPlan = createPlannedCheck(template, options);
    const nativePlan = native.createPlannedCheck(template, options);
    expect(nativePlan).toEqual(sharedPlan);

    expect(native.cancelPlannedCheck(nativePlan)).toEqual(cancelPlannedCheck(sharedPlan));
    const startOptions = { checkRunId: `run.plan.audit.${templateId}` };
    expect(native.startPlannedCheck(nativePlan, LATER, startOptions)).toEqual(
      startPlannedCheck(sharedPlan, LATER, startOptions),
    );
  });

  it("emits the same Backup Envelope facts with a WeChat source marker", () => {
    const native = nativeDomain();
    const snapshot = appSnapshot();

    expect(native.exportBackup(snapshot as never, "wechat" as never, NOW as never)).toEqual(
      exportBackup(snapshot, "wechat", NOW),
    );
  });

  it("emits the same human-readable export without private-note content", () => {
    const native = nativeDomain();
    const template = nativeTemplates().find(
      (candidate) => candidate.templateId === "official.daily_out",
    )!;
    const started = startRun(template, NOW, { checkRunId: "run.readable-audit" });
    const noted = setOneTimeNote(started, started.items[0]!.runItemId, "private-audit-note", LATER);
    const closed = closeRun(noted, {
      intent: "discard",
      now: LATER,
      closedEventId: "closed.readable-audit",
    });
    if (closed.kind !== "discarded") throw new Error("fixture did not close");
    const snapshot = appSnapshot({ checkRuns: [closed.run], updatedAt: LATER });

    expect(native.buildReadableExport(snapshot)).toBe(buildReadableExport(snapshot));
    expect(native.buildReadableExport(snapshot)).not.toContain("private-audit-note");
  });

  it("accepts and rejects the same strict Backup Envelope shapes", () => {
    const native = nativeDomain();
    const template = nativeTemplates().find(
      (candidate) => candidate.templateId === "official.daily_out",
    )!;
    const snapshot = appSnapshot({
      checkRuns: [startRun(template, NOW, { checkRunId: "run.backup-audit" })],
    });
    const valid = exportBackup(snapshot, "wechat", NOW);
    const validRaw = JSON.stringify(valid);
    expect(native.parseAndValidateBackup(validRaw)).toEqual(parseAndValidateBackup(validRaw));
    expect(native.validateSnapshot(snapshot)).toEqual(validateBusinessInvariants(snapshot));

    const invalidCases: Array<[
      string,
      (candidate: Record<string, unknown>) => void,
    ]> = [
      ["unknown envelope field", (candidate) => { candidate.unknown = true; }],
      ["invalid exportedAt", (candidate) => { candidate.exportedAt = "yesterday"; }],
      ["nonexistent calendar date in exportedAt", (candidate) => {
        candidate.exportedAt = "2026-02-29T08:00:00.000+08:00";
      }],
      ["out-of-range hour in exportedAt", (candidate) => {
        candidate.exportedAt = "2026-09-01T24:00:00.000+08:00";
      }],
      ["unknown snapshot field", (candidate) => {
        (candidate.data as Record<string, unknown>).unknown = true;
      }],
      ["invalid item state", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const item = (run.items as Array<Record<string, unknown>>)[0]!;
        item.state = "almostConfirmed";
      }],
      ["oversized private note", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const item = (run.items as Array<Record<string, unknown>>)[0]!;
        item.oneTimeNote = "x".repeat(501);
      }],
      ["invalid favorite identity", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const settings = data.settings as Record<string, unknown>;
        settings.favoriteTemplateIds = [42];
      }],
      ["unknown source identity field", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const identity = run.sourceTemplateIdentity as Record<string, unknown>;
        identity.unknown = "must reject";
      }],
      ["unsafe integer source content version", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const identity = run.sourceTemplateIdentity as Record<string, unknown>;
        identity.contentVersion = Number.MAX_SAFE_INTEGER + 1;
      }],
      ["run item diverges from frozen snapshot", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const item = (run.items as Array<Record<string, unknown>>)[0]!;
        item.title = "被篡改的运行项";
      }],
      ["run drops a frozen source item", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const items = run.items as Array<Record<string, unknown>>;
        items.splice(0, 1);
        items.forEach((item, index) => {
          item.runSortOrder = index;
        });
      }],
      ["temporary item claims a frozen source", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const item = (run.items as Array<Record<string, unknown>>)[0]!;
        item.isTemporary = true;
      }],
      ["linked run diverges from the plan frozen facts", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const hotelTemplate = nativeTemplates().find(
          (entry) => entry.templateId === "official.hotel_checkout",
        )!;
        const plan = createPlannedCheck(hotelTemplate, {
          plannedCheckId: "plan.mismatched-frozen-facts",
          scheduledDate: "2026-09-05",
          createdTimeZoneId: "Asia/Shanghai",
          now: NOW,
        });
        data.plannedChecks = [
          {
            ...plan,
            status: "consumed",
            startedCheckRunId: run.checkRunId,
          },
        ];
        run.sourcePlannedCheckId = plan.plannedCheckId;
      }],
      ["in-progress run has an unmatched close event", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const items = run.items as Array<Record<string, unknown>>;
        run.closedEvents = [
          {
            closedEventId: "closed.impossible",
            type: "endedWithUnresolved",
            closedAt: LATER,
            unresolvedCount: items.length,
            unresolvedKeyCount: items.filter((item) => item.importance === "key").length,
          },
        ];
      }],
      ["zero reopen count has a reopen timestamp", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        run.lastReopenedAt = LATER;
      }],
      ["closed run has an extra unmatched close event", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const items = run.items as Array<Record<string, unknown>>;
        const event = {
          type: "discarded",
          closedAt: LATER,
          unresolvedCount: items.length,
          unresolvedKeyCount: items.filter((item) => item.importance === "key").length,
        };
        run.status = "discarded";
        run.closedEvents = [
          { ...event, closedEventId: "closed.first" },
          { ...event, closedEventId: "closed.extra" },
        ];
      }],
      ["run claims it reopened after a terminal discard", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        const items = run.items as Array<Record<string, unknown>>;
        run.closedEvents = [
          {
            closedEventId: "closed.terminal-discard",
            type: "discarded",
            closedAt: LATER,
            unresolvedCount: items.length,
            unresolvedKeyCount: items.filter((item) => item.importance === "key").length,
          },
        ];
        run.reopenCount = 1;
        run.lastReopenedAt = "2026-09-01T08:06:00.000+08:00";
      }],
      ["prior close event contains impossible unresolved counts", (candidate) => {
        const data = candidate.data as Record<string, unknown>;
        const run = (data.checkRuns as Array<Record<string, unknown>>)[0]!;
        run.closedEvents = [
          {
            closedEventId: "closed.impossible-completed-count",
            type: "completed",
            closedAt: LATER,
            unresolvedCount: 1,
            unresolvedKeyCount: 2,
          },
        ];
        run.reopenCount = 1;
        run.lastReopenedAt = "2026-09-01T08:06:00.000+08:00";
      }],
    ];

    for (const [description, mutate] of invalidCases) {
      const candidate = JSON.parse(validRaw) as Record<string, unknown>;
      mutate(candidate);
      const raw = JSON.stringify(candidate);
      expect(() => parseAndValidateBackup(raw), `shared: ${description}`).toThrow();
      expect(() => native.parseAndValidateBackup(raw), `native: ${description}`).toThrow();
    }
  });

  it("contains only native WXML and no web-view bridge", () => {
    const files = ["home", "run", "plans", "history", "data"].map((page) =>
      readFileSync(resolve(`miniprogram/pages/${page}/${page}.wxml`), "utf8"),
    );

    expect(files.join("\n")).not.toMatch(/<web-view\b/i);
  });
});
