import type { PlannedCheck } from "./schema.js";
import {
  DomainTransitionError,
  snapshotTemplate,
  startRunFromSnapshot,
  templateIdentityFor,
  type StartableTemplate,
} from "./run.js";

export interface LocalWallTime {
  localDate: string;
  localTime: string;
}

export interface CreatePlannedCheckOptions {
  plannedCheckId: string;
  scheduledDate: string;
  scheduledTime?: string;
  createdTimeZoneId: string;
  now: string;
}

export function createPlannedCheck(
  source: StartableTemplate,
  options: CreatePlannedCheckOptions,
): PlannedCheck {
  return {
    plannedCheckId: options.plannedCheckId,
    status: "pending",
    scheduledDate: options.scheduledDate,
    ...(options.scheduledTime
      ? { scheduledTime: options.scheduledTime }
      : {}),
    createdTimeZoneId: options.createdTimeZoneId,
    sourceTemplateIdentity: templateIdentityFor(source),
    plannedTemplateSnapshot: snapshotTemplate(source),
    createdAt: options.now,
  };
}

export function startPlannedCheck(
  plan: PlannedCheck,
  now: string,
  options: { checkRunId?: string } = {},
): { plan: PlannedCheck; run: ReturnType<typeof startRunFromSnapshot> } {
  if (plan.status !== "pending") {
    throw new DomainTransitionError(
      "planNotPending",
      "只有待处理计划可以开始检查。",
    );
  }
  const run = startRunFromSnapshot(
    plan.sourceTemplateIdentity,
    plan.plannedTemplateSnapshot,
    now,
    {
      ...options,
      sourcePlannedCheckId: plan.plannedCheckId,
    },
  );
  return {
    plan: {
      ...plan,
      status: "consumed",
      startedCheckRunId: run.checkRunId,
    },
    run,
  };
}

export function cancelPlannedCheck(plan: PlannedCheck): PlannedCheck {
  if (plan.status !== "pending") return structuredClone(plan);
  return { ...plan, status: "canceled" };
}

function planSortKey(plan: PlannedCheck): string {
  return `${plan.scheduledDate}T${plan.scheduledTime ?? "00:00"}`;
}

export function rankUpcomingPlans(
  plans: readonly PlannedCheck[],
): PlannedCheck[] {
  return plans
    .filter((plan) => plan.status === "pending")
    .map((plan) => structuredClone(plan))
    .sort(
      (left, right) =>
        planSortKey(left).localeCompare(planSortKey(right)) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.plannedCheckId.localeCompare(right.plannedCheckId),
    );
}

export function shouldRemindForPlan(
  plan: PlannedCheck,
  now: LocalWallTime,
): boolean {
  if (plan.status !== "pending") return false;
  if (plan.scheduledDate < now.localDate) return true;
  if (plan.scheduledDate > now.localDate) return false;
  return plan.scheduledTime === undefined || plan.scheduledTime <= now.localTime;
}

function wallTimeMilliseconds(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year!, month! - 1, day!, hour!, minute!);
}

export function dueOrNearPlanSortValue(
  plan: PlannedCheck,
  now: LocalWallTime,
): number | undefined {
  if (plan.status === "canceled") return undefined;
  const current = wallTimeMilliseconds(now.localDate, now.localTime);
  const scheduled = wallTimeMilliseconds(
    plan.scheduledDate,
    plan.scheduledTime ?? "23:59",
  );
  const difference = scheduled - current;
  return difference <= 24 * 60 * 60 * 1000 ? scheduled : undefined;
}
