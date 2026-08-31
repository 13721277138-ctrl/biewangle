import { describe, expect, it } from "vitest";

import {
  cancelPlannedCheck,
  createPlannedCheck,
  rankUpcomingPlans,
  shouldRemindForPlan,
  startPlannedCheck,
} from "../src/plan.js";
import { NOW, ONE_HOUR_LATER, officialTemplate } from "./fixtures.js";

describe("PlannedCheck snapshot and lifecycle contract", () => {
  it("[PLAN-001] starts from the frozen plan snapshot after the source changes", () => {
    const source = officialTemplate("official.daily_out");
    const plan = createPlannedCheck(source, {
      plannedCheckId: "plan-v1",
      scheduledDate: "2026-09-05",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });
    const futureSource = structuredClone(source);
    futureSource.contentVersion = 2;
    futureSource.title = "V2 标题";
    futureSource.groups[0]!.items[0]!.title = "V2 手机";

    const started = startPlannedCheck(plan, ONE_HOUR_LATER, {
      checkRunId: "run-from-plan",
    });

    expect(started.run.runTemplateSnapshot).toEqual(plan.plannedTemplateSnapshot);
    expect(started.run.runTemplateSnapshot.title).toBe("日常出门");
    expect(started.run.runTemplateSnapshot.title).not.toBe(futureSource.title);
  });

  it("[PLAN-002] consumes an early-started plan and records the exact run", () => {
    const plan = createPlannedCheck(officialTemplate("official.daily_out"), {
      plannedCheckId: "plan-early",
      scheduledDate: "2026-09-30",
      scheduledTime: "18:30",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });

    const started = startPlannedCheck(plan, ONE_HOUR_LATER, {
      checkRunId: "run-early",
    });

    expect(started.plan).toMatchObject({
      status: "consumed",
      startedCheckRunId: "run-early",
    });
    expect(started.run.sourcePlannedCheckId).toBe("plan-early");
    expect(rankUpcomingPlans([started.plan])).toEqual([]);
    expect(
      shouldRemindForPlan(started.plan, {
        localDate: "2026-09-30",
        localTime: "18:30",
      }),
    ).toBe(false);
  });

  it("[PLAN-003] keeps date-only plans as literal local calendar dates", () => {
    const plan = createPlannedCheck(officialTemplate("official.daily_out"), {
      plannedCheckId: "plan-date-only",
      scheduledDate: "2026-09-05",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });

    expect(plan.scheduledDate).toBe("2026-09-05");
    expect(plan.scheduledTime).toBeUndefined();
    expect(plan.createdTimeZoneId).toBe("Asia/Shanghai");
  });

  it("[PLAN-004] cancels pending plans and removes both upcoming and reminder projections", () => {
    const plan = createPlannedCheck(officialTemplate("official.daily_out"), {
      plannedCheckId: "plan-cancel",
      scheduledDate: "2026-08-31",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });
    const canceled = cancelPlannedCheck(plan);

    expect(canceled.status).toBe("canceled");
    expect(rankUpcomingPlans([canceled])).toEqual([]);
    expect(
      shouldRemindForPlan(canceled, {
        localDate: "2026-09-01",
        localTime: "08:00",
      }),
    ).toBe(false);
  });

  it("sorts pending plans by literal date, optional time, creation time and id", () => {
    const source = officialTemplate("official.daily_out");
    const later = createPlannedCheck(source, {
      plannedCheckId: "plan-b",
      scheduledDate: "2026-09-02",
      scheduledTime: "09:00",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });
    const earlier = createPlannedCheck(source, {
      plannedCheckId: "plan-a",
      scheduledDate: "2026-09-02",
      scheduledTime: "08:00",
      createdTimeZoneId: "Asia/Shanghai",
      now: ONE_HOUR_LATER,
    });

    expect(rankUpcomingPlans([later, earlier]).map((plan) => plan.plannedCheckId)).toEqual([
      "plan-a",
      "plan-b",
    ]);
  });

  it("places a same-day date-only plan after plans with explicit times", () => {
    const source = officialTemplate("official.daily_out");
    const dateOnly = createPlannedCheck(source, {
      plannedCheckId: "plan-date-only",
      scheduledDate: "2026-09-02",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });
    const timed = createPlannedCheck(source, {
      plannedCheckId: "plan-timed",
      scheduledDate: "2026-09-02",
      scheduledTime: "18:30",
      createdTimeZoneId: "Asia/Shanghai",
      now: ONE_HOUR_LATER,
    });

    expect(rankUpcomingPlans([dateOnly, timed]).map((plan) => plan.plannedCheckId)).toEqual([
      "plan-timed",
      "plan-date-only",
    ]);
  });
});
