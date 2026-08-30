import {
  exportBackup,
  parseAndValidateBackup,
  prepareReset,
  serializeBackup,
  type AppSnapshot,
} from "@biewangle/domain";
import {
  resetDurably,
  restoreFromText,
  type DurableStore,
} from "@biewangle/persistence-contract";
import {
  Database,
  Download,
  FileDown,
  HardDrive,
  RotateCcw,
  ShieldCheck,
  ShieldQuestion,
  Upload,
} from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";

import { useAppStore } from "../../data/use-app-store.js";

type PersistenceState = "checking" | "protected" | "best-effort" | "unsupported";
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function readableExport(snapshot: AppSnapshot): string {
  const lines = [
    "# 别忘了 · 人类可读导出",
    "",
    `导出数据更新时间：${snapshot.updatedAt}`,
    "",
    "## 个人模板",
  ];
  const activeTemplates = snapshot.personalTemplates.filter((template) => !template.deletedAt);
  if (activeTemplates.length === 0) lines.push("- 无");
  for (const template of activeTemplates) {
    lines.push("", `### ${template.title}`);
    for (const group of template.groups) {
      lines.push(`- ${group.title}`);
      for (const item of group.items) lines.push(`  - ${item.title}`);
    }
  }
  lines.push("", "## 待处理计划");
  const plans = snapshot.plannedChecks.filter((plan) => plan.status === "pending");
  if (plans.length === 0) lines.push("- 无");
  for (const plan of plans) {
    lines.push(
      `- ${plan.scheduledDate}${plan.scheduledTime ? ` ${plan.scheduledTime}` : " 全天"} · ${plan.plannedTemplateSnapshot.title}`,
    );
  }
  lines.push("", "## 检查历史摘要");
  const history = snapshot.checkRuns.filter((run) => run.status !== "inProgress");
  if (history.length === 0) lines.push("- 无");
  for (const run of history) {
    lines.push(`- ${run.lastInteractedAt} · ${run.runTemplateSnapshot.title} · ${run.status}`);
  }
  lines.push("", "本文件便于阅读，不用于完整恢复；恢复请使用 JSON 完整备份。");
  return lines.join("\n");
}

export function DataPage() {
  const { snapshot, runtime, repository, commitCommand, reload, pending } = useAppStore();
  const [persistence, setPersistence] = useState<PersistenceState>("checking");
  const [restoreRaw, setRestoreRaw] = useState<string | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<{
    personalTemplates: number;
    plans: number;
    runs: number;
    exportedAt: string;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [resetPhrase, setResetPhrase] = useState("");

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!("storage" in navigator) || !("persisted" in navigator.storage)) {
        if (active) setPersistence("unsupported");
        return;
      }
      const persisted = await navigator.storage.persisted();
      if (active) setPersistence(persisted ? "protected" : "best-effort");
    };
    void check();
    return () => {
      active = false;
    };
  }, []);

  const durableStore: DurableStore<AppSnapshot> = {
    load: () => repository.load(),
    protectiveCopy: (label) => repository.protectiveCopy(label),
    commit: async (next) => {
      await repository.replaceSnapshot(next);
    },
  };

  const downloadBackup = async () => {
    const now = runtime.now();
    let durableSnapshot = snapshot;
    try {
      durableSnapshot = await commitCommand((current) => ({
        ...current,
        lastBackupAt: now,
        updatedAt: now,
      }));
    } catch {
      return;
    }
    downloadText(
      serializeBackup(exportBackup(durableSnapshot, "pwa", now)),
      `别忘了-backup-${runtime.localNow().localDate}.json`,
      "application/json;charset=utf-8",
    );
  };

  const requestPersistence = async () => {
    if (!("storage" in navigator) || !("persist" in navigator.storage)) {
      setPersistence("unsupported");
      return;
    }
    try {
      const granted = await navigator.storage.persist();
      setPersistence(granted ? "protected" : "best-effort");
      setOperationStatus(
        granted
          ? "浏览器已授予本地持久保护。"
          : "浏览器未授予额外保护；当前仍可使用，完整备份更可靠。",
      );
    } catch {
      setPersistence("best-effort");
      setOperationStatus("浏览器未完成额外保护请求；当前仍可使用，完整备份更可靠。");
    }
  };

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setRestoreRaw(null);
    setRestoreSummary(null);
    setRestoreError(null);
    setOperationStatus(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setRestoreError("备份文件超过 10 MB 上限；当前数据未改变。");
      return;
    }
    try {
      const raw = await file.text();
      const envelope = parseAndValidateBackup(raw);
      setRestoreRaw(raw);
      setRestoreSummary({
        personalTemplates: envelope.data.personalTemplates.length,
        plans: envelope.data.plannedChecks.length,
        runs: envelope.data.checkRuns.length,
        exportedAt: envelope.exportedAt,
      });
    } catch (cause) {
      setRestoreError(
        `${cause instanceof Error ? cause.message : "无法解析备份。"} 当前数据未改变。`,
      );
    }
  };

  const restore = async () => {
    if (!restoreRaw) return;
    setRestoreError(null);
    setOperationStatus(null);
    try {
      await restoreFromText(durableStore, restoreRaw);
      await reload();
      setRestoreRaw(null);
      setRestoreSummary(null);
      setOperationStatus("恢复完成，已替换当前本地数据。");
    } catch (cause) {
      setRestoreError(
        `${cause instanceof Error ? cause.message : "恢复失败。"} 当前数据未改变。`,
      );
    }
  };

  const resetAll = async () => {
    if (resetPhrase !== "全部重置") return;
    setRestoreError(null);
    setOperationStatus(null);
    try {
      await resetDurably(durableStore, prepareReset(snapshot, runtime.now()));
      await reload();
      setResetPhrase("");
      setOperationStatus("已重置当前设备数据；执行前保护副本已保留在本地数据库。");
    } catch (cause) {
      setRestoreError(
        `${cause instanceof Error ? cause.message : "重置失败。"} 当前数据未改变。`,
      );
    }
  };

  const persistenceCopy = {
    checking: "正在检查浏览器保护状态…",
    protected: "浏览器已授予本地持久保护。",
    "best-effort": "当前为尽力保存；浏览器仍可能在空间紧张时清理数据。",
    unsupported: "当前浏览器不提供持久保护状态。",
  }[persistence];

  return (
    <section className="page data-management-page">
      <div className="page-title-row">
        <span className="title-icon"><Database aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">透明的数据边界</p>
          <h1>数据与备份</h1>
        </div>
      </div>
      {restoreError ? <p className="restore-alert" role="alert">{restoreError}</p> : null}
      {operationStatus ? <p className="operation-status" role="status">{operationStatus}</p> : null}

      <div className="data-management-layout">
        <nav className="data-section-index" aria-label="数据管理目录">
          <a href="#protection">本地保护</a>
          <a href="#backup">备份与导出</a>
          <a href="#restore">整体恢复</a>
          <a href="#reset">全部重置</a>
        </nav>
        <div className="data-section-stack">
          <section className="data-panel" id="protection">
            <div className="data-panel-heading">
              {persistence === "protected" ? <ShieldCheck /> : <ShieldQuestion />}
              <div>
                <h2>本地持久保护</h2>
                <p>{persistenceCopy}</p>
              </div>
            </div>
            {persistence !== "protected" ? (
              <button className="secondary-button" type="button" onClick={() => void requestPersistence()}>
                请求浏览器额外保护
              </button>
            ) : null}
            <p className="boundary-caption">持久存储不是备份；清除站点数据、卸载或设备丢失仍可能造成数据消失。</p>
          </section>

          <section className="data-panel emphasis" id="backup">
            <div className="data-panel-heading">
              <HardDrive />
              <div>
                <h2>完整备份与可读导出</h2>
                <p>JSON 用于整体恢复；Markdown 用于长期阅读，两者用途不同。</p>
              </div>
            </div>
            <dl className="data-stats">
              <div><dt>个人模板</dt><dd>{snapshot.personalTemplates.length}</dd></div>
              <div><dt>计划</dt><dd>{snapshot.plannedChecks.length}</dd></div>
              <div><dt>Run</dt><dd>{snapshot.checkRuns.length}</dd></div>
              <div><dt>最近备份</dt><dd>{snapshot.lastBackupAt ? new Date(snapshot.lastBackupAt).toLocaleString("zh-CN") : "尚未备份"}</dd></div>
            </dl>
            <div className="inline-actions">
              <button className="primary-button" type="button" disabled={pending} onClick={() => void downloadBackup()}>
                <Download size={18} /> 下载完整备份
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  downloadText(
                    readableExport(snapshot),
                    `别忘了-readable-${runtime.localNow().localDate}.md`,
                    "text/markdown;charset=utf-8",
                  )
                }
              ><FileDown size={18} /> 下载可读 Markdown</button>
            </div>
          </section>

          <section className="data-panel" id="restore">
            <div className="data-panel-heading">
              <Upload />
              <div>
                <h2>整体恢复</h2>
                <p>先创建当前数据保护副本，再校验产品、格式、Schema 和业务不变量，全部通过后才原子替换。</p>
              </div>
            </div>
            <label className="file-picker">
              <span>选择备份文件</span>
              <input type="file" accept="application/json,.json" onChange={(event) => void selectBackup(event)} />
            </label>
            {restoreSummary ? (
              <div className="restore-preview">
                <strong>文件已通过校验，尚未恢复</strong>
                <p>导出于 {new Date(restoreSummary.exportedAt).toLocaleString("zh-CN")} · {restoreSummary.personalTemplates} 个个人模板 · {restoreSummary.plans} 个计划 · {restoreSummary.runs} 个 Run</p>
                <button className="warning-button" type="button" onClick={() => void restore()}>
                  确认整体恢复
                </button>
              </div>
            ) : null}
          </section>

          <section className="data-panel danger-zone" id="reset">
            <div className="data-panel-heading">
              <RotateCcw />
              <div>
                <h2>全部重置</h2>
                <p>清空个人模板、计划、Run、收藏与隐藏设置；官方模板回到初始状态。</p>
              </div>
            </div>
            <label>
              <span>输入“全部重置”确认</span>
              <input value={resetPhrase} onChange={(event) => setResetPhrase(event.target.value)} />
            </label>
            <button
              className="warning-button"
              type="button"
              disabled={pending || resetPhrase !== "全部重置"}
              onClick={() => void resetAll()}
            >执行全部重置</button>
          </section>
        </div>
      </div>
    </section>
  );
}
