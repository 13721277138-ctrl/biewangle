import {
  startPlannedCheck,
  type AppSnapshot,
} from "@biewangle/domain";

export function startPlanInSnapshot(
  snapshot: AppSnapshot,
  plannedCheckId: string,
  checkRunId: string,
  now: string,
): AppSnapshot {
  const plan = snapshot.plannedChecks.find(
    (candidate) => candidate.plannedCheckId === plannedCheckId,
  );
  if (!plan) throw new Error("计划不存在");
  const started = startPlannedCheck(plan, now, { checkRunId });
  return {
    ...snapshot,
    plannedChecks: snapshot.plannedChecks.map((candidate) =>
      candidate.plannedCheckId === plannedCheckId ? started.plan : candidate,
    ),
    checkRuns: [...snapshot.checkRuns, started.run],
    updatedAt: now,
  };
}
