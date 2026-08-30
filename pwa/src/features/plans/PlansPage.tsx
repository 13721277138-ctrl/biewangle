import { cancelPlannedCheck, rankUpcomingPlans } from "@biewangle/domain";
import {
  CalendarClock,
  CalendarPlus,
  Download,
  Play,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAppStore } from "../../data/use-app-store.js";
import { startPlanInSnapshot } from "./plan-actions.js";

function escapeCalendarText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function calendarText(plan: ReturnType<typeof rankUpcomingPlans>[number]): string {
  const date = plan.scheduledDate.replaceAll("-", "");
  const start = plan.scheduledTime
    ? `DTSTART;TZID=${plan.createdTimeZoneId}:${date}T${plan.scheduledTime.replace(":", "")}00`
    : `DTSTART;VALUE=DATE:${date}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Biewangle//V1.1//ZH-CN",
    "BEGIN:VEVENT",
    `UID:${escapeCalendarText(plan.plannedCheckId)}@biewangle.local`,
    start,
    `SUMMARY:${escapeCalendarText(`别忘了：${plan.plannedTemplateSnapshot.title}`)}`,
    "DESCRIPTION:打开别忘了，按计划创建时冻结的清单完成检查。",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadCalendar(plan: ReturnType<typeof rankUpcomingPlans>[number]) {
  const blob = new Blob([calendarText(plan)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `别忘了-${plan.scheduledDate}-${plan.plannedCheckId}.ics`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PlansPage() {
  const { snapshot, runtime, commitCommand, pending } = useAppStore();
  const navigate = useNavigate();
  const plans = rankUpcomingPlans(snapshot.plannedChecks);

  const startPlan = async (plannedCheckId: string) => {
    const now = runtime.now();
    const checkRunId = runtime.newId("run");
    try {
      await commitCommand((current) =>
        startPlanInSnapshot(current, plannedCheckId, checkRunId, now),
      );
      navigate(`/runs/${checkRunId}`);
    } catch {
      // Global save feedback remains visible.
    }
  };

  const cancel = async (plannedCheckId: string) => {
    const now = runtime.now();
    try {
      await commitCommand((current) => ({
        ...current,
        plannedChecks: current.plannedChecks.map((plan) =>
          plan.plannedCheckId === plannedCheckId
            ? cancelPlannedCheck(plan)
            : plan,
        ),
        updatedAt: now,
      }));
    } catch {
      // Global save feedback remains visible.
    }
  };

  return (
    <section className="page narrow-page plans-page">
      <header className="management-header">
        <div className="page-title-row">
          <span className="title-icon"><CalendarClock aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">L0 应用内提示</p>
            <h1>全部计划</h1>
          </div>
        </div>
        <Link className="primary-button link-button" to="/plans/new">
          <CalendarPlus size={18} /> 创建计划
        </Link>
      </header>
      <p className="lede">计划按本地日历保存；取消或开始后不会继续作为未来计划提示。</p>
      {plans.length === 0 ? (
        <div className="empty-card">
          <CalendarClock aria-hidden="true" />
          <h2>没有待处理计划</h2>
          <p>计划不是闹钟；打开应用时，这里会诚实显示到期或即将到期的安排。</p>
        </div>
      ) : (
        <div className="all-plans-list">
          {plans.map((plan) => (
            <article className="all-plan-card" key={plan.plannedCheckId}>
              <div>
                <p className="card-kicker">冻结快照 · {plan.createdTimeZoneId}</p>
                <h2>{plan.plannedTemplateSnapshot.title}</h2>
                <p>{plan.scheduledDate}{plan.scheduledTime ? ` ${plan.scheduledTime}` : " 全天"}</p>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  aria-label={`开始计划 ${plan.plannedTemplateSnapshot.title}`}
                  disabled={pending}
                  onClick={() => void startPlan(plan.plannedCheckId)}
                ><Play size={17} /> 开始</button>
                <button
                  type="button"
                  aria-label={`导出日历 ${plan.plannedTemplateSnapshot.title}`}
                  onClick={() => downloadCalendar(plan)}
                ><Download size={17} /> .ics</button>
                <button
                  type="button"
                  aria-label={`取消计划 ${plan.plannedTemplateSnapshot.title}`}
                  disabled={pending}
                  onClick={() => void cancel(plan.plannedCheckId)}
                ><X size={17} /> 取消</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="boundary-note">
        <strong>日历导出是 L1 增强，不等于已设置系统提醒。</strong>
        <p>下载 .ics 后仍需由你在系统日历中确认导入；本应用不会声称平台已提醒。</p>
      </div>
    </section>
  );
}
