import { dueOrNearPlanSortValue, type LocalWallTime } from "./plan.js";
import type { CheckRun, PlannedCheck } from "./schema.js";

export function rankContinueRuns(
  runs: readonly CheckRun[],
  plans: readonly PlannedCheck[],
  now: LocalWallTime,
): CheckRun[] {
  const planById = new Map(plans.map((plan) => [plan.plannedCheckId, plan]));
  const urgency = (run: CheckRun): number | undefined => {
    if (!run.sourcePlannedCheckId) return undefined;
    const plan = planById.get(run.sourcePlannedCheckId);
    return plan ? dueOrNearPlanSortValue(plan, now) : undefined;
  };

  return runs
    .filter((run) => run.status === "inProgress")
    .map((run) => structuredClone(run))
    .sort((left, right) => {
      const leftUrgency = urgency(left);
      const rightUrgency = urgency(right);
      const leftPrioritized = leftUrgency !== undefined;
      const rightPrioritized = rightUrgency !== undefined;
      if (leftPrioritized !== rightPrioritized) {
        return leftPrioritized ? -1 : 1;
      }
      if (
        leftUrgency !== undefined &&
        rightUrgency !== undefined &&
        leftUrgency !== rightUrgency
      ) {
        return leftUrgency - rightUrgency;
      }
      return (
        right.lastInteractedAt.localeCompare(left.lastInteractedAt) ||
        right.startedAt.localeCompare(left.startedAt) ||
        left.checkRunId.localeCompare(right.checkRunId)
      );
    });
}
