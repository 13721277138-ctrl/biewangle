import {
  rankContinueRuns,
  rankUpcomingPlans,
  startPlannedCheck,
  startRun,
  type AppSnapshot,
  type OfficialTemplate,
} from "@biewangle/domain";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Clock3,
  Play,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { verticalSliceTemplates } from "../../content/official-content.js";
import { useAppStore } from "../../data/use-app-store.js";

function replacePlanAndAppendRun(
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

export function HomePage() {
  const { snapshot, runtime, commitCommand, pending } = useAppStore();
  const navigate = useNavigate();
  const continueRuns = rankContinueRuns(
    snapshot.checkRuns,
    snapshot.plannedChecks,
    runtime.localNow(),
  );
  const upcomingPlans = rankUpcomingPlans(snapshot.plannedChecks).slice(0, 3);

  const startTemplate = async (template: OfficialTemplate) => {
    const now = runtime.now();
    const checkRunId = runtime.newId("run");
    const run = startRun(template, now, { checkRunId });
    try {
      await commitCommand((current) => ({
        ...current,
        checkRuns: [...current.checkRuns, run],
        updatedAt: now,
      }));
      navigate(`/runs/${checkRunId}`);
    } catch {
      // The provider keeps the durable snapshot visible and shows the error.
    }
  };

  const startPlan = async (plannedCheckId: string) => {
    const now = runtime.now();
    const checkRunId = runtime.newId("run");
    try {
      await commitCommand((current) =>
        replacePlanAndAppendRun(current, plannedCheckId, checkRunId, now),
      );
      navigate(`/runs/${checkRunId}`);
    } catch {
      // Visible persistence feedback is owned by the provider.
    }
  };

  return (
    <section className="page home-page">
      <div className="hero-copy">
        <p className="eyebrow">今天的记忆入口</p>
        <h1>今天，有什么要确认的？</h1>
        <p className="lede">选择场景，直接开始。每一次检查都只记录在当前设备。</p>
      </div>

      {continueRuns[0] ? (
        <section className="home-section" aria-labelledby="continue-heading">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">最优先</p>
              <h2 id="continue-heading">继续检查</h2>
            </div>
          </div>
          <button
            type="button"
            className="continue-card"
            onClick={() => navigate(`/runs/${continueRuns[0]!.checkRunId}`)}
          >
            <span>
              <strong>{continueRuns[0].runTemplateSnapshot.title}</strong>
              <small>
                {continueRuns[0].items.filter((item) => item.state === "unchecked").length}
                项待处理
              </small>
            </span>
            <span className="round-icon"><Play size={19} fill="currentColor" /></span>
          </button>
          {continueRuns.length > 1 ? (
            <p className="quiet-note">另有 {continueRuns.length - 1} 次进行中的检查</p>
          ) : null}
        </section>
      ) : null}

      {upcomingPlans.length > 0 ? (
        <section className="home-section" aria-labelledby="upcoming-heading">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">最多显示三项</p>
              <h2 id="upcoming-heading">接下来</h2>
            </div>
          </div>
          <div className="plan-list">
            {upcomingPlans.map((plan) => (
              <article className="plan-card" key={plan.plannedCheckId}>
                <span className="plan-date-icon"><CalendarClock size={20} /></span>
                <div>
                  <strong>{plan.plannedTemplateSnapshot.title}</strong>
                  <p>
                    {plan.scheduledDate}
                    {plan.scheduledTime ? ` ${plan.scheduledTime}` : " 全天"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`提前开始计划 ${plan.plannedTemplateSnapshot.title}`}
                  disabled={pending}
                  onClick={() => void startPlan(plan.plannedCheckId)}
                >
                  开始
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="home-section" aria-labelledby="featured-heading">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">代表性纵切</p>
            <h2 id="featured-heading">马上开始</h2>
          </div>
          <span className="section-meta"><Clock3 size={16} /> 约 1 分钟</span>
        </div>
        <div className="template-grid">
          {verticalSliceTemplates.map((template, index) => (
            <article className="template-card" key={template.templateId}>
              <div className="template-card-top">
                <span className="template-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </div>
              <h3>{template.title}</h3>
              <p>{template.applicability}</p>
              <button
                type="button"
                aria-label={`开始 ${template.title}`}
                disabled={pending}
                onClick={() => void startTemplate(template)}
              >
                直接开始 <ArrowRight size={17} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
