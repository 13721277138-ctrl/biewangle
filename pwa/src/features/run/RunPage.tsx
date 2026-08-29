import {
  addTemporaryItem,
  closeRun,
  filterRunItems,
  markNotNeeded,
  toggleConfirmed,
  type AppSnapshot,
  type CheckRun,
  type CloseRunOptions,
  type CloseRunResult,
  type RunItemView,
} from "@biewangle/domain";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Circle,
  KeyRound,
  ListFilter,
  Minus,
  Plus,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { useAppStore } from "../../data/use-app-store.js";

function replaceRun(snapshot: AppSnapshot, nextRun: CheckRun, now: string): AppSnapshot {
  return {
    ...snapshot,
    checkRuns: snapshot.checkRuns.map((run) =>
      run.checkRunId === nextRun.checkRunId ? nextRun : run,
    ),
    updatedAt: now,
  };
}

function closedRunFrom(result: CloseRunResult): CheckRun | undefined {
  return result.kind === "completed" ||
    result.kind === "endedWithUnresolved" ||
    result.kind === "discarded"
    ? result.run
    : undefined;
}

function ClosedRun({ run }: { run: CheckRun }) {
  const lastEvent = run.closedEvents.at(-1);
  const completed = run.status === "completed";
  return (
    <section className="page run-page closed-run-page">
      <div className={completed ? "completion-orb" : "completion-orb warning"}>
        {completed ? <Check size={36} /> : <AlertTriangle size={34} />}
      </div>
      <p className="eyebrow">{run.runTemplateSnapshot.title}</p>
      <h1>{completed ? "这份清单已全部处理" : "本次检查已结束"}</h1>
      <p className="completion-copy">
        {completed
          ? "可以放心出发。"
          : `仍有 ${lastEvent?.unresolvedCount ?? 0} 项未确认，其中 ${lastEvent?.unresolvedKeyCount ?? 0} 项为关键项。`}
      </p>
      <div className="completion-actions">
        <Link className="primary-button link-button" to="/history">查看历史</Link>
        <Link className="secondary-button link-button" to="/">回到首页</Link>
      </div>
    </section>
  );
}

export function RunPage() {
  const { runId } = useParams();
  const { snapshot, runtime, commitCommand, pending } = useAppStore();
  const [view, setView] = useState<RunItemView>("all");
  const [temporaryTitle, setTemporaryTitle] = useState("");
  const [closeState, setCloseState] = useState<
    | { kind: "unresolved"; unresolvedCount: number; unresolvedKeyCount: number }
    | { kind: "keyConfirmation"; unresolvedCount: number; unresolvedKeyCount: number }
    | null
  >(null);
  const run = snapshot.checkRuns.find((candidate) => candidate.checkRunId === runId);

  const visibleItems = useMemo(
    () => (run ? filterRunItems(run, view) : []),
    [run, view],
  );

  if (!run) {
    return (
      <section className="page narrow-page">
        <h1>找不到这次检查</h1>
        <p className="lede">它可能尚未保存，或已从当前设备移除。</p>
        <Link to="/" className="primary-button link-button">回到首页</Link>
      </section>
    );
  }
  if (run.status !== "inProgress") return <ClosedRun run={run} />;

  const update = async (
    transform: (currentRun: CheckRun, now: string) => CheckRun,
  ) => {
    const now = runtime.now();
    try {
      await commitCommand((current) => {
        const currentRun = current.checkRuns.find(
          (candidate) => candidate.checkRunId === run.checkRunId,
        );
        if (!currentRun) throw new Error("检查不存在");
        return replaceRun(current, transform(currentRun, now), now);
      });
    } catch {
      // UI stays on the last durable snapshot and the provider shows an alert.
    }
  };

  const commitClose = async (
    intent: CloseRunOptions["intent"],
    keyRiskConfirmed = false,
  ) => {
    const now = runtime.now();
    const closedEventId = runtime.newId("close");
    try {
      await commitCommand((current) => {
        const currentRun = current.checkRuns.find(
          (candidate) => candidate.checkRunId === run.checkRunId,
        );
        if (!currentRun) throw new Error("检查不存在");
        const result = closeRun(currentRun, {
          intent,
          now,
          keyRiskConfirmed,
          closedEventId,
        });
        const nextRun = closedRunFrom(result);
        if (!nextRun) throw new Error(`关闭条件未满足：${result.kind}`);
        return replaceRun(current, nextRun, now);
      });
      setCloseState(null);
    } catch {
      // Durable errors remain visible at app level.
    }
  };

  const attemptComplete = () => {
    const result = closeRun(run, {
      intent: "complete",
      now: runtime.now(),
      closedEventId: "preview-only",
    });
    if (result.kind === "rejected") {
      setCloseState({
        kind: "unresolved",
        unresolvedCount: result.unresolvedCount,
        unresolvedKeyCount: result.unresolvedKeyCount,
      });
      return;
    }
    void commitClose("complete");
  };

  const attemptEndWithUnresolved = () => {
    const result = closeRun(run, {
      intent: "endWithUnresolved",
      now: runtime.now(),
      closedEventId: "preview-only",
    });
    if (result.kind === "needsKeyConfirmation") {
      setCloseState({ ...result, kind: "keyConfirmation" });
      return;
    }
    void commitClose("endWithUnresolved");
  };

  const addTemporary = (event: FormEvent) => {
    event.preventDefault();
    const title = temporaryTitle.trim();
    if (!title) return;
    void update((current, now) =>
      addTemporaryItem(current, { title }, now, {
        runItemId: runtime.newId("temporary"),
      }),
    ).then(() => setTemporaryTitle(""));
  };

  const handledCount = run.items.filter((item) => item.state !== "unchecked").length;
  const percentage = Math.round((handledCount / run.items.length) * 100);

  return (
    <section className="page run-page">
      <div className="run-topline">
        <Link to="/" className="back-link"><ArrowLeft size={18} /> 暂时离开</Link>
        <span className="autosave-label">每步自动保存</span>
      </div>
      <div className="run-heading">
        <div>
          <p className="eyebrow">正在检查</p>
          <h1>{run.runTemplateSnapshot.title}</h1>
        </div>
        <div className="progress-number" aria-label={`已处理 ${percentage}%`}>
          <strong>{handledCount}</strong><span>/{run.items.length}</span>
        </div>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>

      <div className="view-toggle" aria-label="项目筛选">
        <ListFilter size={17} aria-hidden="true" />
        <button
          type="button"
          aria-pressed={view === "all"}
          onClick={() => setView("all")}
        >全部</button>
        <button
          type="button"
          aria-pressed={view === "key"}
          onClick={() => setView("key")}
        ><KeyRound size={15} /> 关键项</button>
      </div>

      <div className="run-list" aria-live="polite">
        {visibleItems.map((item) => (
          <article
            className={`run-item state-${item.state}`}
            key={item.runItemId}
            data-testid={`run-item-${item.sourceItemId ?? item.runItemId}`}
          >
            <button
              type="button"
              className="confirm-button"
              aria-label={`确认 ${item.title}`}
              aria-pressed={item.state === "confirmed"}
              disabled={pending}
              onClick={() =>
                void update((current, now) =>
                  toggleConfirmed(current, item.runItemId, now),
                )
              }
            >
              <span className="state-icon" aria-hidden="true">
                {item.state === "confirmed" ? <Check size={18} /> : <Circle size={18} />}
              </span>
              <span className="item-copy">
                <strong>{item.title}</strong>
                {item.condition ? <small>{item.condition}</small> : null}
                {item.isTemporary ? <small>本次临时项</small> : null}
              </span>
              {item.importance === "key" ? <span className="key-badge">关键</span> : null}
            </button>
            <button
              type="button"
              className="not-needed-button"
              aria-label={`本次不需要 ${item.title}`}
              aria-pressed={item.state === "notNeeded"}
              disabled={pending}
              onClick={() =>
                void update((current, now) =>
                  markNotNeeded(current, item.runItemId, now),
                )
              }
            >
              <Minus size={15} aria-hidden="true" />
              {item.state === "notNeeded" ? "本次不需要" : "不需要"}
            </button>
          </article>
        ))}
      </div>

      <form className="temporary-form" onSubmit={addTemporary}>
        <label htmlFor="temporary-item">临时项目</label>
        <div>
          <input
            id="temporary-item"
            value={temporaryTitle}
            maxLength={100}
            placeholder="只加到这一次，例如：门窗复查"
            onChange={(event) => setTemporaryTitle(event.target.value)}
          />
          <button type="submit" disabled={pending || !temporaryTitle.trim()}>
            <Plus size={18} /> 加入本次
          </button>
        </div>
      </form>

      {closeState ? (
        <aside className="close-panel" aria-live="assertive">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>
              {closeState.kind === "keyConfirmation"
                ? "关键项仍未确认"
                : `仍有${closeState.unresolvedCount}项未确认`}
            </strong>
            <p>
              其中 {closeState.unresolvedKeyCount} 项为关键项。你可以继续检查，也可以诚实结束并保留这个事实。
            </p>
            <div className="inline-actions">
              <button type="button" className="secondary-button" onClick={() => setCloseState(null)}>
                继续检查
              </button>
              {closeState.kind === "keyConfirmation" ? (
                <button
                  type="button"
                  className="warning-button"
                  onClick={() => void commitClose("endWithUnresolved", true)}
                >确认仍然结束</button>
              ) : (
                <button
                  type="button"
                  className="warning-button"
                  onClick={attemptEndWithUnresolved}
                >结束并保留</button>
              )}
            </div>
          </div>
        </aside>
      ) : null}

      <div className="run-footer">
        <p>只有全部项目都“已确认”或“本次不需要”，才会记为完成。</p>
        <button
          type="button"
          className="primary-button"
          disabled={pending}
          onClick={attemptComplete}
        >完成检查</button>
      </div>
    </section>
  );
}
