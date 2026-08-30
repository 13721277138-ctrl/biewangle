import { Clock3, Layers3, Play } from "lucide-react";
import { Link } from "react-router-dom";

import { useAppStore } from "../../data/use-app-store.js";

export function RunsPage() {
  const { snapshot } = useAppStore();
  const activeRuns = snapshot.checkRuns
    .filter((run) => run.status === "inProgress")
    .sort(
      (left, right) =>
        right.lastInteractedAt.localeCompare(left.lastInteractedAt) ||
        right.startedAt.localeCompare(left.startedAt) ||
        left.checkRunId.localeCompare(right.checkRunId),
    );

  return (
    <section className="page narrow-page">
      <div className="page-title-row">
        <span className="title-icon"><Layers3 aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">每次现实检查都独立</p>
          <h1>全部进行中</h1>
        </div>
      </div>
      <p className="lede">同一模板可以同时有多次检查；这里始终按具体 Run 区分。</p>
      {activeRuns.length === 0 ? (
        <div className="empty-card">
          <Layers3 aria-hidden="true" />
          <h2>没有进行中的检查</h2>
          <Link className="primary-button link-button" to="/templates">选择模板</Link>
        </div>
      ) : (
        <div className="active-run-list">
          {activeRuns.map((run) => {
            const unresolved = run.items.filter((item) => item.state === "unchecked").length;
            return (
              <article className="active-run-card" key={run.checkRunId}>
                <div>
                  <p className="card-kicker"><Clock3 size={15} /> {new Date(run.lastInteractedAt).toLocaleString("zh-CN")}</p>
                  <h2>{run.runTemplateSnapshot.title}</h2>
                  <p>{unresolved} 项待处理 · Run {run.checkRunId.slice(-8)}</p>
                </div>
                <Link
                  className="primary-button link-button"
                  aria-label={`继续 ${run.runTemplateSnapshot.title} ${run.checkRunId}`}
                  to={`/runs/${run.checkRunId}`}
                ><Play size={18} /> 继续</Link>
              </article>
            );
          })}
        </div>
      )}
      <Link className="secondary-button link-button plans-link" to="/plans">查看全部计划</Link>
    </section>
  );
}
