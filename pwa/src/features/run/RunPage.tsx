import {
  addTemporaryItem,
  buildRunClosureReceipt,
  closeRun,
  filterRunItems,
  markNotNeeded,
  reorderRunItems,
  setOneTimeNote,
  toggleConfirmed,
  type AppSnapshot,
  type CheckRun,
  type CheckRunItem,
  type CloseRunOptions,
  type CloseRunResult,
  type RunItemView,
} from "@biewangle/domain";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  KeyRound,
  ListFilter,
  Minus,
  NotebookPen,
  Plus,
  Trash2,
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
  const receipt = buildRunClosureReceipt(run)!;
  const completed = receipt.kind === "completed";
  return (
    <section className="page run-page closed-run-page">
      <div className={completed ? "completion-orb" : "completion-orb warning"}>
        {completed ? <Check size={36} /> : <AlertTriangle size={34} />}
      </div>
      <p className="eyebrow">{run.runTemplateSnapshot.title}</p>
      <h1>{receipt.title}</h1>
      <p className="completion-copy">{receipt.message}</p>
      <div className="completion-actions">
        <Link className="primary-button link-button" to={`/history/${run.checkRunId}`}>查看本次事实</Link>
        <Link className="secondary-button link-button" to="/history">查看历史</Link>
        <Link className="secondary-button link-button" to="/">回到首页</Link>
      </div>
    </section>
  );
}

function RunItemTools({
  item,
  pending,
  onSaveNote,
  onMove,
}: {
  item: CheckRunItem;
  pending: boolean;
  onSaveNote(note: string): Promise<void>;
  onMove(delta: -1 | 1): Promise<void>;
}) {
  const [note, setNote] = useState(item.oneTimeNote ?? "");
  return (
    <details className="run-item-tools">
      <summary><NotebookPen size={15} /> 备注与本次排序</summary>
      <label>
        <span>本次备注（默认不会分享）</span>
        <textarea
          rows={2}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="item-tool-actions">
        <button
          type="button"
          disabled={pending || note === (item.oneTimeNote ?? "")}
          onClick={() => void onSaveNote(note.trim())}
        >保存备注</button>
        <button type="button" aria-label={`上移 ${item.title}`} disabled={pending} onClick={() => void onMove(-1)}>
          <ChevronUp size={16} /> 上移
        </button>
        <button type="button" aria-label={`下移 ${item.title}`} disabled={pending} onClick={() => void onMove(1)}>
          <ChevronDown size={16} /> 下移
        </button>
      </div>
    </details>
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
    | { kind: "discardConfirmation"; unresolvedCount: number; unresolvedKeyCount: number }
    | null
  >(null);
  const run = snapshot.checkRuns.find((candidate) => candidate.checkRunId === runId);

  const visibleItems = useMemo(
    () => (run ? filterRunItems(run, view) : []),
    [run, view],
  );
  const groupTitles = useMemo(
    () =>
      new Map(
        run?.runTemplateSnapshot.groups.map((group) => [
          group.groupId,
          group.title,
        ]) ?? [],
      ),
    [run],
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

  const moveItem = async (runItemId: string, delta: -1 | 1) => {
    await update((current, now) => {
      const ordered = filterRunItems(current, "all");
      const index = ordered.findIndex((item) => item.runItemId === runItemId);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return current;
      const ids = ordered.map((item) => item.runItemId);
      [ids[index], ids[nextIndex]] = [ids[nextIndex]!, ids[index]!];
      return reorderRunItems(current, ids, now);
    });
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
                <small className="item-group-label">
                  {groupTitles.get(item.groupId) ?? "本次临时项"}
                </small>
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
            <RunItemTools
              item={item}
              pending={pending}
              onSaveNote={(note) =>
                update((current, now) =>
                  setOneTimeNote(
                    current,
                    item.runItemId,
                    note || undefined,
                    now,
                  ),
                )
              }
              onMove={(delta) => moveItem(item.runItemId, delta)}
            />
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
              {closeState.kind === "discardConfirmation"
                ? "丢弃这次检查？"
                : closeState.kind === "keyConfirmation"
                ? "关键项仍未确认"
                : `仍有${closeState.unresolvedCount}项未确认`}
            </strong>
            <p>
              {closeState.kind === "discardConfirmation"
                ? "丢弃不会删除历史；本次将以 discarded 状态保留。"
                : `其中 ${closeState.unresolvedKeyCount} 项为关键项。你可以继续检查，也可以诚实结束并保留这个事实。`}
            </p>
            <div className="inline-actions">
              <button type="button" className="secondary-button" onClick={() => setCloseState(null)}>
                继续检查
              </button>
              {closeState.kind === "discardConfirmation" ? (
                <button
                  type="button"
                  className="warning-button"
                  onClick={() => void commitClose("discard")}
                >确认丢弃并保留事实</button>
              ) : closeState.kind === "keyConfirmation" ? (
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
        <div className="inline-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={() =>
              setCloseState({
                kind: "discardConfirmation",
                unresolvedCount: run.items.filter((item) => item.state === "unchecked").length,
                unresolvedKeyCount: run.items.filter(
                  (item) => item.state === "unchecked" && item.importance === "key",
                ).length,
              })
            }
          ><Trash2 size={17} /> 丢弃本次</button>
          <button
            type="button"
            className="primary-button"
            disabled={pending}
            onClick={attemptComplete}
          >完成检查</button>
        </div>
      </div>
    </section>
  );
}
