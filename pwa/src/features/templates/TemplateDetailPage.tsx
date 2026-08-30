import type { OfficialTemplate, PersonalTemplate } from "@biewangle/domain";
import {
  ArrowLeft,
  CalendarPlus,
  Copy,
  FilePenLine,
  Play,
  Share2,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { officialTemplates } from "../../content/official-content.js";
import { useAppStore } from "../../data/use-app-store.js";
import { useStartTemplate } from "./use-start-template.js";

function resolveTemplate(
  kind: string | undefined,
  templateId: string | undefined,
  personalTemplates: readonly PersonalTemplate[],
): OfficialTemplate | PersonalTemplate | undefined {
  if (kind === "official") {
    return officialTemplates.find((template) => template.templateId === templateId);
  }
  if (kind === "personal") {
    return personalTemplates.find(
      (template) => template.personalTemplateId === templateId && !template.deletedAt,
    );
  }
  return undefined;
}

export function TemplateDetailPage() {
  const { kind, templateId } = useParams();
  const { snapshot } = useAppStore();
  const { startTemplate, pending } = useStartTemplate();
  const template = resolveTemplate(kind, templateId, snapshot.personalTemplates);

  if (!template) {
    return (
      <section className="page narrow-page">
        <h1>找不到这个模板</h1>
        <Link className="primary-button link-button" to="/templates">返回模板库</Link>
      </section>
    );
  }

  const isOfficial = "templateId" in template;
  const identity = isOfficial ? template.templateId : template.personalTemplateId;
  return (
    <section className="page template-detail-page">
      <Link className="back-link" to="/templates">
        <ArrowLeft size={18} /> 返回模板库
      </Link>
      <div className="detail-layout">
        <aside className="detail-rail">
          <p className="eyebrow">{isOfficial ? "官方原件" : "个人模板"}</p>
          <h1>{template.title}</h1>
          {isOfficial ? <p className="lede">{template.applicability}</p> : null}
          <div className="detail-action-stack">
            <button
              type="button"
              className="primary-button"
              disabled={pending}
              onClick={() => void startTemplate(template)}
            ><Play size={18} /> 直接开始</button>
            <Link
              className="secondary-button link-button"
              to={`/plans/new?template=${encodeURIComponent(`${kind}:${identity}`)}`}
            ><CalendarPlus size={18} /> 创建计划</Link>
            <Link
              className="secondary-button link-button"
              to={
                isOfficial
                  ? `/templates/new?source=${encodeURIComponent(identity)}`
                  : `/templates/personal/${encodeURIComponent(identity)}/edit`
              }
            ><FilePenLine size={18} /> {isOfficial ? "永久修改为个人副本" : "编辑"}</Link>
            {!isOfficial ? (
              <Link
                className="secondary-button link-button"
                to={`/templates/new?copy=${encodeURIComponent(identity)}`}
              ><Copy size={18} /> 复制为新模板</Link>
            ) : null}
            <Link
              className="secondary-button link-button"
              to={`/share/template/${kind}/${encodeURIComponent(identity)}`}
            ><Share2 size={18} /> 分享预览</Link>
          </div>
          <p className="boundary-caption">
            {isOfficial
              ? "永久修改不会覆盖官方原件。"
              : "个人模板分享为可读文本，不伪装成长期在线链接。"}
          </p>
        </aside>
        <div className="template-groups">
          {template.groups.map((group) => (
            <section key={group.groupId} className="template-group-card">
              <h2>{group.title}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.itemId}>
                    <span>{item.title}</span>
                    {item.importance === "key" ? <strong>关键</strong> : null}
                    {item.condition ? <small>{item.condition}</small> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
