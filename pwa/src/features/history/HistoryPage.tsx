import { Archive, CheckCircle2, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { useAppStore } from "../../data/use-app-store.js";

export function HistoryPage() {
  const { snapshot } = useAppStore();
  const closedRuns = snapshot.checkRuns
    .filter((run) => run.status !== "inProgress")
    .sort((left, right) => right.lastInteractedAt.localeCompare(left.lastInteractedAt));

  return (
    <section className="page narrow-page">
      <div className="page-title-row">
        <span className="title-icon"><Archive aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">只读事实</p>
          <h1>检查历史</h1>
        </div>
      </div>
      <p className="lede">历史来自每一次 Check Run 和关闭事件，不另建一份可变记录。</p>
      {closedRuns.length === 0 ? (
        <div className="empty-card">
          <Archive aria-hidden="true" />
          <h2>还没有结束的检查</h2>
          <p>完成或诚实结束一次检查后，会在这里留下事实。</p>
          <Link className="primary-button link-button" to="/">开始第一次检查</Link>
        </div>
      ) : (
        <div className="history-list">
          {closedRuns.map((run) => {
            const event = run.closedEvents.at(-1);
            const completed = run.status === "completed";
            return (
              <Link
                className="history-card"
                key={run.checkRunId}
                to={`/history/${run.checkRunId}`}
              >
                <span className={completed ? "history-status success" : "history-status warning"}>
                  {completed ? <CheckCircle2 /> : <CircleAlert />}
                </span>
                <div>
                  <h2>{run.runTemplateSnapshot.title}</h2>
                  <p>{new Date(run.lastInteractedAt).toLocaleString("zh-CN")}</p>
                  <small>
                    {completed
                      ? "全部处理"
                      : `${event?.unresolvedCount ?? 0} 项未确认 · ${event?.unresolvedKeyCount ?? 0} 项关键`}
                  </small>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
