import { searchTemplates, type SearchMatchField } from "@biewangle/domain";
import { ArrowLeft, FileSearch, Play, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { officialTemplates } from "../../content/official-content.js";
import { useAppStore } from "../../data/use-app-store.js";
import { useStartTemplate } from "../templates/use-start-template.js";

const MATCH_LABELS: Record<SearchMatchField, string> = {
  title: "模板名称",
  aliases: "场景别名",
  itemTitle: "检查项",
  applicability: "适用说明",
  hint: "项目提示",
};

export function SearchPage() {
  const { snapshot } = useAppStore();
  const { startTemplate, pending } = useStartTemplate();
  const [query, setQuery] = useState("");
  const officialResults = useMemo(
    () => searchTemplates(officialTemplates, query),
    [query],
  );
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const personalResults = normalized
    ? snapshot.personalTemplates.filter(
        (template) =>
          !template.deletedAt &&
          (template.title.toLocaleLowerCase("zh-CN").includes(normalized) ||
            template.groups.some((group) =>
              group.items.some((item) =>
                item.title.toLocaleLowerCase("zh-CN").includes(normalized),
              ),
            )),
      )
    : [];
  const total = officialResults.length + personalResults.length;

  return (
    <section className="page narrow-page search-page">
      <Link className="back-link" to="/"><ArrowLeft size={18} /> 返回首页</Link>
      <div className="page-title-row">
        <span className="title-icon"><Search aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">无需网络或 AI</p>
          <h1>搜索模板</h1>
        </div>
      </div>
      <label className="search-field">
        <span className="sr-only">搜索模板</span>
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          aria-label="搜索模板"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="试试：护照、医保卡、保险箱"
        />
      </label>
      <p className="search-boundary">仅在本机匹配模板名称、别名、检查项、适用说明和提示。</p>

      {!normalized ? (
        <div className="empty-card compact">
          <FileSearch aria-hidden="true" />
          <p>输入你担心忘记的物品或场景。</p>
        </div>
      ) : total === 0 ? (
        <div className="empty-card compact">
          <FileSearch aria-hidden="true" />
          <h2>没有找到</h2>
          <p>可以换个词，或新建个人模板。</p>
          <Link className="primary-button link-button" to="/templates/new">新建模板</Link>
        </div>
      ) : (
        <div className="search-results" aria-live="polite">
          <p className="result-count">找到 {total} 个模板</p>
          {officialResults.map((result) => (
            <article className="search-result-card" key={result.template.templateId}>
              <div>
                <p className="card-kicker">官方模板 · 命中 {result.matches.map((match) => MATCH_LABELS[match]).join("、")}</p>
                <h2>{result.template.title}</h2>
                <p>{result.template.applicability}</p>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  aria-label={`开始 ${result.template.title}`}
                  disabled={pending}
                  onClick={() => void startTemplate(result.template)}
                ><Play size={17} /> 开始</button>
                <Link to={`/templates/official/${result.template.templateId}`}>查看</Link>
              </div>
            </article>
          ))}
          {personalResults.map((template) => (
            <article className="search-result-card" key={template.personalTemplateId}>
              <div>
                <p className="card-kicker">个人模板 · 本机内容</p>
                <h2>{template.title}</h2>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  aria-label={`开始 ${template.title}`}
                  disabled={pending}
                  onClick={() => void startTemplate(template)}
                ><Play size={17} /> 开始</button>
                <Link to={`/templates/personal/${template.personalTemplateId}`}>查看</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
