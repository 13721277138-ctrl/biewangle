import { describe, expect, it } from "vitest";

import { rankContinueRuns } from "../src/home.js";
import { createPlannedCheck, startPlannedCheck } from "../src/plan.js";
import { startRun } from "../src/run.js";
import { NOW, officialTemplate } from "./fixtures.js";

describe("home continue-run ranking", () => {
  it("[HOME-001] lets a due or near planned run outrank a more recently touched ad-hoc run", () => {
    const template = officialTemplate("official.daily_out");
    const plan = createPlannedCheck(template, {
      plannedCheckId: "plan-due",
      scheduledDate: "2026-09-01",
      scheduledTime: "09:00",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });
    const planned = startPlannedCheck(plan, "2026-09-01T07:00:00.000+08:00", {
      checkRunId: "run-planned",
    });
    const recentAdHoc = startRun(template, "2026-09-01T08:50:00.000+08:00", {
      checkRunId: "run-recent",
    });

    const ranked = rankContinueRuns(
      [recentAdHoc, planned.run],
      [planned.plan],
      { localDate: "2026-09-01", localTime: "08:30" },
    );
    expect(ranked.map((run) => run.checkRunId)).toEqual([
      "run-planned",
      "run-recent",
    ]);
  });

  it("[HOME-002] falls back to last interaction, then start time, then stable id", () => {
    const template = officialTemplate("official.daily_out");
    const old = startRun(template, "2026-09-01T06:00:00.000+08:00", {
      checkRunId: "run-old",
    });
    const latest = startRun(template, "2026-09-01T07:00:00.000+08:00", {
      checkRunId: "run-latest",
    });
    const tieA = {
      ...old,
      checkRunId: "run-a",
      startedAt: "2026-09-01T05:00:00.000+08:00",
      lastInteractedAt: "2026-09-01T05:00:00.000+08:00",
    };
    const tieB = {
      ...old,
      checkRunId: "run-b",
      startedAt: "2026-09-01T05:00:00.000+08:00",
      lastInteractedAt: "2026-09-01T05:00:00.000+08:00",
    };

    expect(
      rankContinueRuns([old, tieB, latest, tieA], [], {
        localDate: "2026-09-01",
        localTime: "08:30",
      }).map((run) => run.checkRunId),
    ).toEqual(["run-latest", "run-old", "run-a", "run-b"]);
  });

  it("does not surface closed runs in the continue projection", () => {
    const template = officialTemplate("official.daily_out");
    const run = startRun(template, NOW, { checkRunId: "run-closed" });

    expect(
      rankContinueRuns([{ ...run, status: "discarded" }], [], {
        localDate: "2026-09-01",
        localTime: "08:30",
      }),
    ).toEqual([]);
  });
});
