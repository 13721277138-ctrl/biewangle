import { RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppStore } from "../data/use-app-store.js";

export const UPDATE_READY_EVENT = "biewangle:update-ready";

interface UpdateReadyDetail {
  activate(): Promise<void>;
}

export function UpdatePrompt() {
  const { snapshot } = useAppStore();
  const [activate, setActivate] = useState<(() => Promise<void>) | null>(null);
  const hasActiveRun = snapshot.checkRuns.some(
    (run) => run.status === "inProgress",
  );

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<UpdateReadyDetail>).detail;
      if (detail?.activate) setActivate(() => detail.activate);
    };
    window.addEventListener(UPDATE_READY_EVENT, listener);
    return () => window.removeEventListener(UPDATE_READY_EVENT, listener);
  }, []);

  if (!activate) return null;

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <RefreshCw aria-hidden="true" size={20} />
      <div>
        <strong>新版本已准备好</strong>
        <p>
          {hasActiveRun
            ? "当前检查会继续使用已加载版本；结束或暂时离开后再更新。"
            : "本地数据已经保存，可以安全载入新版本。"}
        </p>
      </div>
      {hasActiveRun ? null : (
        <button type="button" onClick={() => void activate()}>
          立即更新
        </button>
      )}
      <button
        type="button"
        className="icon-button"
        aria-label="暂不更新"
        onClick={() => setActivate(null)}
      >
        <X size={18} />
      </button>
    </aside>
  );
}
