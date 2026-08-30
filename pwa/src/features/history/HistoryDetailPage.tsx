import { reopenRun, restartFromHistory } from "@biewangle/domain";
import {
  ArrowLeft,
  History,
  Play,
  RotateCcw,
  Share2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAppStore } from "../../data/use-app-store.js";

const STATUS_COPY = {
  completed: "全部处理",
  endedWithUnresolved: "有未确认项后结束",
  discarded: "已丢弃并保留事实",
  inProgress: "进行中",
} as const;

export function HistoryDetailPage() {
  const { runId } = useParams();
  const { snapshot, runtime, commitCommand, pending } = useAppStore();
  const navigate = useNavigate();
  const run = snapshot.checkRuns.find((candidate) => candidate.checkRunId === runId);

  if (!run || run.status === "inProgress") {
    return (
      <section className="page narrow-page">
        <h1>找不到这条历史</h1>
        <Link className="primary-button link-button" to="/history">返回历史</Link>
      </section>
    );
  }

  const reopenPreview = reopenRun(run, runtime.now());
  const canReopen = reopenPreview.kind === "reopened";

  const reopen = async () => {
    const now = runtime.now();
    try {
      await commitCommand((current) => {
        const currentRun = current.checkRuns.find(
          (candidate) => candidate.checkRunId === run.checkRunId,
        );
        if (!currentRun) throw new Error("历史不存在");
        const result = reopenRun(currentRun, now);
        if (result.kind !== "reopened") throw new Error("当前不能重开");
        return {
          ...current,
          checkRuns: current.checkRuns.map((candidate) =>
            candidate.checkRunId === run.checkRunId ? result.run : candidate,
          ),
          updatedAt: now,
        };
      });
      navigate(`/runs/${run.checkRunId}`);
    } catch {
      // Global save feedback remains visible.
    }
  };

  const restart = async () => {
    const now = runtime.now();
    const checkRunId = runtime.newId("run");
    const nextRun = restartFromHistory(run, now, { checkRunId });
    try {
      await commitCommand((current) => ({
        ...current,
        checkRuns: [...current.checkRuns, nextRun],
        updatedAt: now,
      }));
      navigate(`/runs/${checkRunId}`);
    } catch {
      // Global save feedback remains visible.
    }
  };

  return (
    <section className="page history-detail-page">
      <Link className="back-link" to="/history"><ArrowLeft size={18} /> 返回历史</Link>
      <div className="history-detail-layout">
        <aside className="history-fact-rail">
          <p className="eyebrow">不可抹去的 Run 事实</p>
          <h1>{run.runTemplateSnapshot.title}</h1>
          <span className={`fact-status status-${run.status}`}>{STATUS_COPY[run.status]}</span>
          <dl>
            <div><dt>开始</dt><dd>{new Date(run.startedAt).toLocaleString("zh-CN")}</dd></div>
            <div><dt>最后互动</dt><dd>{new Date(run.lastInteractedAt).toLocaleString("zh-CN")}</dd></div>
            <div><dt>重开次数</dt><dd>{run.reopenCount}</dd></div>
          </dl>
          <div className="detail-action-stack">
            {canReopen ? (
              <button
                type="button"
                className="primary-button"
                disabled={pending}
                onClick={() => void reopen()}
              ><RotateCcw size={18} /> 重开本次检查</button>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={pending}
                onClick={() => void restart()}
              ><Play size={18} /> 基于本次重新开始</button>
            )}
            <Link
              className="secondary-button link-button"
              to={`/share/run/${run.checkRunId}`}
            ><Share2 size={18} /> 分享预览</Link>
          </div>
          <p className="boundary-caption">
            {canReopen
              ? "关闭后 2 小时内可纠错；旧关闭事件会保留。"
              : "已超过纠错窗口或状态不可重开；只能创建新的 Run。"}
          </p>
        </aside>
        <div className="history-facts">
          <section className="fact-panel">
            <h2>本次项目</h2>
            <ul className="history-item-list">
              {[...run.items]
                .sort((left, right) => left.runSortOrder - right.runSortOrder)
                .map((item) => (
                  <li key={item.runItemId}>
                    <span>{item.title}</span>
                    <strong>{
                      item.state === "confirmed"
                        ? "已确认"
                        : item.state === "notNeeded"
                          ? "本次不需要"
                          : "未确认"
                    }</strong>
                  </li>
                ))}
            </ul>
          </section>
          <section className="fact-panel">
            <h2><History size={20} /> 关闭事件</h2>
            <ol className="event-timeline">
              {run.closedEvents.map((event) => (
                <li key={event.closedEventId}>
                  <strong>{STATUS_COPY[event.type]}</strong>
                  <span>{new Date(event.closedAt).toLocaleString("zh-CN")}</span>
                  <small>{event.unresolvedCount} 项未确认 · {event.unresolvedKeyCount} 项关键</small>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </section>
  );
}
