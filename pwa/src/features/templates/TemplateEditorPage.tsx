import {
  derivePersonalTemplate,
  PersonalTemplateSchema,
  type OfficialTemplate,
  type PersonalTemplate,
} from "@biewangle/domain";
import { ArrowLeft, Palette, Save } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  findOfficialTemplate,
  officialTemplates,
} from "../../content/official-content.js";
import { useAppStore } from "../../data/use-app-store.js";
import {
  buildEditableGroups,
  draftFromTemplate,
  groupsToItemLines,
  TEMPLATE_COLORS,
  TEMPLATE_ICONS,
} from "./template-form.js";

function templateFromSource(
  sourceId: string | null,
  copyId: string | null,
  personalTemplates: readonly PersonalTemplate[],
): OfficialTemplate | PersonalTemplate | undefined {
  if (sourceId) {
    return officialTemplates.find((template) => template.templateId === sourceId);
  }
  if (copyId) {
    return personalTemplates.find(
      (template) => template.personalTemplateId === copyId,
    );
  }
  return undefined;
}

export function TemplateEditorPage() {
  const { templateId } = useParams();
  const [searchParams] = useSearchParams();
  const { snapshot, runtime, commitCommand, pending } = useAppStore();
  const navigate = useNavigate();
  const editing = templateId
    ? snapshot.personalTemplates.find(
        (template) => template.personalTemplateId === templateId,
      )
    : undefined;
  const source = templateFromSource(
    searchParams.get("source"),
    searchParams.get("copy"),
    snapshot.personalTemplates,
  );
  const initialTemplate = editing ?? source;
  const initialDraft = useMemo(
    () => draftFromTemplate(initialTemplate),
    [initialTemplate],
  );
  const [title, setTitle] = useState(initialDraft.title);
  const [itemLines, setItemLines] = useState(initialDraft.itemLines);
  const [icon, setIcon] = useState(initialDraft.icon);
  const [themeColor, setThemeColor] = useState(initialDraft.themeColor);
  const [formError, setFormError] = useState<string | null>(null);
  const itemCount = itemLines.split(/\r?\n/u).filter((line) => line.trim()).length;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("请填写模板名称。");
      return;
    }
    const now = runtime.now();
    const personalTemplateId =
      editing?.personalTemplateId ?? runtime.newId("personal");
    try {
      const sourceGroups = editing?.groups ?? source?.groups ?? [];
      const groups =
        initialTemplate && groupsToItemLines(initialTemplate.groups) === itemLines.trim()
          ? structuredClone(initialTemplate.groups)
          : buildEditableGroups(personalTemplateId, itemLines, sourceGroups);
      let next: PersonalTemplate;
      if (editing) {
        next = PersonalTemplateSchema.parse({
          ...editing,
          title: cleanTitle,
          groups,
          icon,
          themeColor,
          updatedAt: now,
        });
      } else if (source && "templateId" in source) {
        next = derivePersonalTemplate(
          findOfficialTemplate(source.templateId),
          { title: cleanTitle, groups, icon, themeColor },
          now,
          { personalTemplateId },
        );
      } else {
        const personalSource =
          source && "personalTemplateId" in source ? source : undefined;
        next = PersonalTemplateSchema.parse({
          personalTemplateId,
          ...(personalSource?.derivedFromTemplateId
            ? { derivedFromTemplateId: personalSource.derivedFromTemplateId }
            : {}),
          ...(personalSource?.derivedFromContentVersion
            ? {
                derivedFromContentVersion:
                  personalSource.derivedFromContentVersion,
              }
            : {}),
          title: cleanTitle,
          groups,
          icon,
          themeColor,
          createdAt: now,
          updatedAt: now,
        });
      }

      await commitCommand((current) => ({
        ...current,
        personalTemplates: editing
          ? current.personalTemplates.map((candidate) =>
              candidate.personalTemplateId === editing.personalTemplateId
                ? next
                : candidate,
            )
          : [...current.personalTemplates, next],
        updatedAt: now,
      }));
      navigate("/templates");
    } catch (cause) {
      if (cause instanceof Error && !cause.message.includes("未保存")) {
        setFormError(cause.message);
      }
    }
  };

  return (
    <section className="page editor-page">
      <Link to="/templates" className="back-link">
        <ArrowLeft size={18} /> 返回模板库
      </Link>
      <div className="editor-layout">
        <header className="editor-intro">
          <p className="eyebrow">只修改个人副本</p>
          <h1>{editing ? "编辑个人模板" : "新建个人模板"}</h1>
          <p className="lede">
            官方模板永远保留原件。永久修改会保存为当前设备上的个人模板。
          </p>
          <div className={`editor-preview theme-${themeColor}`}>
            <span>{icon}</span>
            <strong>{title.trim() || "未命名模板"}</strong>
            <small>{itemCount} 个检查项</small>
          </div>
        </header>
        <form className="form-card template-editor-form" onSubmit={(event) => void submit(event)}>
          {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          <label>
            <span>模板名称</span>
            <input
              required
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：晨间出门"
            />
          </label>
          <label>
            <span>检查项（每行一项）</span>
            <textarea
              required
              rows={12}
              value={itemLines}
              onChange={(event) => setItemLines(event.target.value)}
              placeholder={"钥匙\n耳机\n水杯"}
            />
          </label>
          {itemCount > 60 ? (
            <p className="soft-warning">这份清单较长；仍可保存，使用时建议分组或精简。</p>
          ) : null}
          <div className="form-grid">
            <label>
              <span>图标</span>
              <select value={icon} onChange={(event) => setIcon(event.target.value)}>
                {TEMPLATE_ICONS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span><Palette size={16} /> 主题色</span>
              <select
                value={themeColor}
                onChange={(event) => setThemeColor(event.target.value)}
              >
                {TEMPLATE_COLORS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <button
            className="primary-button"
            type="submit"
            disabled={pending || !title.trim() || itemCount === 0}
          >
            <Save size={18} /> 保存个人模板
          </button>
        </form>
      </div>
    </section>
  );
}
