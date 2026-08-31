import { describe, expect, it } from "vitest";

import {
  buildReadableExport,
  closeRun,
  createPlannedCheck,
  setOneTimeNote,
  startRun,
} from "../src/index.js";
import { appSnapshot } from "./app-fixtures.js";
import { NOW, ONE_HOUR_LATER, officialTemplate, personalTemplate } from "./fixtures.js";

describe("human-readable local export", () => {
  it("summarizes active personal templates, pending plans and closed history without private notes", () => {
    const activePersonal = personalTemplate({ title: "我的出门模板" });
    const deletedPersonal = personalTemplate({
      personalTemplateId: "personal.deleted",
      title: "不应出现在可读导出",
      deletedAt: ONE_HOUR_LATER,
    });
    const pendingPlan = createPlannedCheck(officialTemplate("official.hotel_checkout"), {
      plannedCheckId: "plan.readable",
      scheduledDate: "2026-09-05",
      scheduledTime: "09:30",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });
    const started = startRun(officialTemplate("official.daily_out"), NOW, {
      checkRunId: "run.readable",
    });
    const noted = setOneTimeNote(started, started.items[0]!.runItemId, "绝不能进入可读导出", NOW);
    const closed = closeRun(noted, {
      intent: "discard",
      now: ONE_HOUR_LATER,
      closedEventId: "closed.readable",
    });
    if (closed.kind !== "discarded") throw new Error("fixture did not close");
    const snapshot = appSnapshot({
      personalTemplates: [activePersonal, deletedPersonal],
      plannedChecks: [pendingPlan],
      checkRuns: [closed.run],
      updatedAt: ONE_HOUR_LATER,
    });

    const text = buildReadableExport(snapshot);

    expect(text).toContain("# 别忘了 · 人类可读导出");
    expect(text).toContain("### 我的出门模板");
    expect(text).toContain("2026-09-05 09:30 · 离开酒店");
    expect(text).toContain("2026-09-01T09:00:00.000+08:00 · 日常出门 · 已放弃");
    expect(text).toContain("不用于完整恢复");
    expect(text).not.toContain("不应出现在可读导出");
    expect(text).not.toContain("绝不能进入可读导出");
  });
});
