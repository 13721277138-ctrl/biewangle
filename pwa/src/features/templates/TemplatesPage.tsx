import {
  restorePersonalTemplate,
  softDeletePersonalTemplate,
  type PersonalTemplate,
} from "@biewangle/domain";
import {
  ArchiveRestore,
  EyeOff,
  Heart,
  LibraryBig,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { officialTemplates } from "../../content/official-content.js";
import { useAppStore } from "../../data/use-app-store.js";
import { useStartTemplate } from "./use-start-template.js";

function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

export function TemplatesPage() {
  const { snapshot, runtime, commitCommand, pending } = useAppStore();
  const { startTemplate } = useStartTemplate();
  const [showDeleted, setShowDeleted] = useState(false);
  const activePersonal = snapshot.personalTemplates.filter(
    (template) => !template.deletedAt,
  );
  const deletedPersonal = snapshot.personalTemplates.filter(
    (template) => template.deletedAt,
  );
  const visibleOfficial = officialTemplates.filter(
    (template) =>
      !snapshot.settings.hiddenOfficialTemplateIds.includes(template.templateId),
  );

  const updateSettings = async (
    key: "favoriteTemplateIds" | "hiddenOfficialTemplateIds",
    templateId: string,
  ) => {
    const now = runtime.now();
    try {
      await commitCommand((current) => ({
        ...current,
        settings: {
          ...current.settings,
          [key]: toggleValue(current.settings[key], templateId),
        },
        updatedAt: now,
      }));
    } catch {
      // Global save feedback remains visible.
    }
  };

  const updatePersonal = async (
    template: PersonalTemplate,
    action: "delete" | "restore",
  ) => {
    const now = runtime.now();
    try {
      await commitCommand((current) => ({
        ...current,
        personalTemplates: current.personalTemplates.map((candidate) =>
          candidate.personalTemplateId === template.personalTemplateId
            ? action === "delete"
              ? softDeletePersonalTemplate(candidate, now)
              : restorePersonalTemplate(candidate, now)
            : candidate,
        ),
        updatedAt: now,
      }));
    } catch {
      // Global save feedback remains visible.
    }
  };

  return (
    <section className="page management-page templates-page">
      <header className="management-header">
        <div className="page-title-row">
          <span className="title-icon"><LibraryBig aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">官方原件 + 个人副本</p>
            <h1>模板库</h1>
          </div>
        </div>
        <div className="header-actions">
          <Link className="secondary-button link-button" to="/search">
            <Search size={18} /> 搜索
          </Link>
          <Link className="primary-button link-button" to="/templates/new">
            <Plus size={18} /> 新建个人模板
          </Link>
        </div>
      </header>

      <div className="management-layout">
        <aside className="management-summary" aria-label="模板概况">
          <strong>{visibleOfficial.length}</strong>
          <span>个可见官方模板</span>
          <strong>{activePersonal.length}</strong>
          <span>个个人模板</span>
          <p>收藏和隐藏只改变当前设备上的入口；官方原件始终不被改写。</p>
        </aside>
        <div className="management-main">
          {activePersonal.length > 0 ? (
            <section className="template-library-section" aria-labelledby="personal-heading">
              <div className="section-heading-row">
                <div>
                  <p className="section-kicker">只在本机</p>
                  <h2 id="personal-heading">我的模板</h2>
                </div>
              </div>
              <div className="library-grid">
                {activePersonal.map((template) => (
                  <article
                    className="library-card personal"
                    data-testid="personal-template-card"
                    key={template.personalTemplateId}
                  >
                    <span className={`template-swatch theme-${template.themeColor ?? "jade"}`}>
                      {template.icon ?? "check"}
                    </span>
                    <div className="library-card-copy">
                      <p className="card-kicker">个人模板</p>
                      <h3>{template.title}</h3>
                      <p>{template.groups.flatMap((group) => group.items).length} 个检查项</p>
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        aria-label={`开始 ${template.title}`}
                        disabled={pending}
                        onClick={() => void startTemplate(template)}
                      ><Play size={17} /> 开始</button>
                      <Link to={`/templates/personal/${template.personalTemplateId}`}>管理</Link>
                      <button
                        type="button"
                        aria-label={`删除 ${template.title}`}
                        disabled={pending}
                        onClick={() => void updatePersonal(template, "delete")}
                      ><Trash2 size={17} /> 删除</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="template-library-section" aria-labelledby="official-heading">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">内容版本 1</p>
                <h2 id="official-heading">官方模板</h2>
              </div>
              {snapshot.settings.hiddenOfficialTemplateIds.length > 0 ? (
                <Link to="/settings">管理已隐藏</Link>
              ) : null}
            </div>
            <div className="library-grid">
              {visibleOfficial.map((template) => {
                const favorite = snapshot.settings.favoriteTemplateIds.includes(
                  template.templateId,
                );
                const itemCount = template.groups.flatMap((group) => group.items).length;
                return (
                  <article
                    className="library-card"
                    data-testid="official-template-card"
                    key={template.templateId}
                  >
                    <div className="library-card-copy">
                      <p className="card-kicker">
                        {template.featuredOrder ? `精选 ${template.featuredOrder}` : "官方场景"}
                      </p>
                      <h3>{template.title}</h3>
                      <p>{template.applicability}</p>
                      <small>{itemCount} 项 · {template.groups.length} 组</small>
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        aria-label={`开始 ${template.title}`}
                        disabled={pending}
                        onClick={() => void startTemplate(template)}
                      ><Play size={17} /> 开始</button>
                      <Link to={`/templates/official/${template.templateId}`}>详情</Link>
                      <button
                        type="button"
                        aria-pressed={favorite}
                        aria-label={`${favorite ? "取消收藏" : "收藏"} ${template.title}`}
                        disabled={pending}
                        onClick={() =>
                          void updateSettings("favoriteTemplateIds", template.templateId)
                        }
                      ><Heart size={17} fill={favorite ? "currentColor" : "none"} /> 收藏</button>
                      <button
                        type="button"
                        aria-label={`隐藏 ${template.title}`}
                        disabled={pending}
                        onClick={() =>
                          void updateSettings(
                            "hiddenOfficialTemplateIds",
                            template.templateId,
                          )
                        }
                      ><EyeOff size={17} /> 隐藏</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {deletedPersonal.length > 0 ? (
            <section className="deleted-templates">
              <button
                type="button"
                className="secondary-button"
                aria-expanded={showDeleted}
                onClick={() => setShowDeleted((current) => !current)}
              >
                <Trash2 size={17} /> 查看已删除模板
              </button>
              {showDeleted ? (
                <div className="deleted-list">
                  {deletedPersonal.map((template) => (
                    <article key={template.personalTemplateId}>
                      <span>{template.title}</span>
                      <button
                        type="button"
                        aria-label={`恢复 ${template.title}`}
                        disabled={pending}
                        onClick={() => void updatePersonal(template, "restore")}
                      ><ArchiveRestore size={17} /> 恢复</button>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
