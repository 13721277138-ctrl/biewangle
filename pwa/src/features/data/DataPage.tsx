import { exportBackup, serializeBackup } from "@biewangle/domain";
import { Database, Download, HardDrive, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppStore } from "../../data/use-app-store.js";

type PersistenceState = "checking" | "protected" | "best-effort" | "unsupported";

export function DataPage() {
  const { snapshot, runtime } = useAppStore();
  const [persistence, setPersistence] = useState<PersistenceState>("checking");

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

  const downloadBackup = () => {
    const envelope = exportBackup(snapshot, "pwa", runtime.now());
    const blob = new Blob([serializeBackup(envelope)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `别忘了-backup-${runtime.localNow().localDate}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const persistenceCopy = {
    checking: "正在检查浏览器保护状态…",
    protected: "浏览器已授予本地持久保护。",
    "best-effort": "当前为尽力保存；浏览器仍可能在空间紧张时清理数据。",
    unsupported: "当前浏览器不提供持久保护状态。",
  }[persistence];

  return (
    <section className="page narrow-page">
      <div className="page-title-row">
        <span className="title-icon"><Database aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">透明的数据边界</p>
          <h1>数据与备份</h1>
        </div>
      </div>
      <div className="data-grid">
        <article className="data-card">
          {persistence === "protected" ? <ShieldCheck /> : <ShieldQuestion />}
          <div>
            <h2>本地持久保护</h2>
            <p>{persistenceCopy}</p>
          </div>
        </article>
        <article className="data-card emphasis">
          <HardDrive />
          <div>
            <h2>完整备份</h2>
            <p>备份是独立 JSON 文件；它与浏览器的持久保护不是一回事。</p>
            <button className="primary-button" type="button" onClick={downloadBackup}>
              <Download size={18} /> 下载完整备份
            </button>
          </div>
        </article>
      </div>
      <div className="boundary-note">
        <strong>数据默认只在当前设备、当前浏览器。</strong>
        <p>清除站点数据、卸载、重装、设备丢失或换设备，都可能让本地数据消失。</p>
      </div>
    </section>
  );
}
