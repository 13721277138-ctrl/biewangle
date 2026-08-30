import { PRODUCT_CONFIG } from "@biewangle/domain";
import {
  Database,
  Eye,
  HardDrive,
  Info,
  Settings,
  Smartphone,
} from "lucide-react";
import { Link } from "react-router-dom";

import { officialTemplates } from "../../content/official-content.js";
import { useAppStore } from "../../data/use-app-store.js";

export function SettingsPage() {
  const { snapshot, runtime, commitCommand, pending } = useAppStore();
  const hidden = officialTemplates.filter((template) =>
    snapshot.settings.hiddenOfficialTemplateIds.includes(template.templateId),
  );

  const restoreOfficial = async (templateId: string) => {
    const now = runtime.now();
    try {
      await commitCommand((current) => ({
        ...current,
        settings: {
          ...current.settings,
          hiddenOfficialTemplateIds:
            current.settings.hiddenOfficialTemplateIds.filter(
              (candidate) => candidate !== templateId,
            ),
        },
        updatedAt: now,
      }));
    } catch {
      // Global save feedback remains visible.
    }
  };

  const setBackupNudge = async (dismissed: boolean) => {
    const now = runtime.now();
    try {
      await commitCommand((current) => ({
        ...current,
        settings: { ...current.settings, backupNudgeDismissed: dismissed },
        updatedAt: now,
      }));
    } catch {
      // Global save feedback remains visible.
    }
  };

  return (
    <section className="page narrow-page settings-page">
      <div className="page-title-row">
        <span className="title-icon"><Settings aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">少而透明</p>
          <h1>设置</h1>
        </div>
      </div>
      <div className="settings-stack">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <Eye />
            <div><h2>已隐藏官方模板</h2><p>隐藏只影响入口，官方原件没有被删除。</p></div>
          </div>
          {hidden.length === 0 ? <p className="quiet-note">没有已隐藏模板。</p> : (
            <ul className="settings-list">
              {hidden.map((template) => (
                <li key={template.templateId}>
                  <span>{template.title}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void restoreOfficial(template.templateId)}
                  >恢复显示</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <HardDrive />
            <div><h2>备份提示</h2><p>只在已有个人资产且长期未备份时低打扰出现。</p></div>
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={!snapshot.settings.backupNudgeDismissed}
              onChange={(event) => void setBackupNudge(!event.target.checked)}
            />
            <span>允许一次低打扰备份提示</span>
          </label>
          <Link className="secondary-button link-button" to="/data">
            <Database size={18} /> 打开数据与备份
          </Link>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <Smartphone />
            <div><h2>安装与离线</h2><p>首次联网加载并缓存后，核心检查可离线使用。</p></div>
          </div>
          <ul className="plain-guidance">
            <li>iPhone / iPad：浏览器分享菜单 → 添加到主屏幕。</li>
            <li>Mac Safari 17（macOS Sonoma 14+）：文件 → 添加到程序坞。</li>
            <li>普通浏览器标签页也可使用；安装不改变“数据只在当前浏览器”边界。</li>
          </ul>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <Info />
            <div><h2>产品事实</h2><p>这些是集中配置，不会追溯改写历史。</p></div>
          </div>
          <dl className="config-facts">
            <div><dt>版本</dt><dd>1.1.0</dd></div>
            <div><dt>官方内容版本</dt><dd>1</dd></div>
            <div><dt>历史纠错窗口</dt><dd>{PRODUCT_CONFIG.REOPEN_WINDOW_HOURS} 小时</dd></div>
            <div><dt>中断提示阈值</dt><dd>{PRODUCT_CONFIG.STALE_AFTER_HOURS} 小时</dd></div>
            <div><dt>账号 / 云同步 / AI / Analytics</dt><dd>均未启用</dd></div>
          </dl>
          <p className="boundary-caption">全部重置位于“数据与备份”页面底部，并要求强确认和执行前保护副本。</p>
        </section>
      </div>
    </section>
  );
}
