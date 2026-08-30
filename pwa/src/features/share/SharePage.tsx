import {
  buildSharePreview,
  type CheckRun,
  type OfficialTemplate,
  type PersonalTemplate,
} from "@biewangle/domain";
import { ArrowLeft, Clipboard, Download, Send, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { officialTemplates } from "../../content/official-content.js";
import { useAppStore } from "../../data/use-app-store.js";

function templateText(template: OfficialTemplate | PersonalTemplate): string {
  const lines = [`# ${template.title}`];
  for (const group of template.groups) {
    lines.push("", `## ${group.title}`);
    for (const item of group.items) lines.push(`- ${item.title}`);
  }
  return lines.join("\n");
}

function fileDownload(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function SharePage() {
  const { runId, kind, templateId } = useParams();
  const { snapshot } = useAppStore();
  const navigate = useNavigate();
  const [projection, setProjection] = useState<"checklist" | "runResult">("checklist");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const run: CheckRun | undefined = snapshot.checkRuns.find(
    (candidate) => candidate.checkRunId === runId,
  );
  const template = kind === "official"
    ? officialTemplates.find((candidate) => candidate.templateId === templateId)
    : kind === "personal"
      ? snapshot.personalTemplates.find(
          (candidate) => candidate.personalTemplateId === templateId && !candidate.deletedAt,
        )
      : undefined;
  const text = useMemo(() => {
    if (run) {
      return buildSharePreview(
        run,
        projection === "checklist"
          ? { kind: "checklist" }
          : { kind: "runResult", includeOneTimeNotes: includeNotes },
      ).text;
    }
    return template ? templateText(template) : "";
  }, [run, template, projection, includeNotes]);
  const title = run?.runTemplateSnapshot.title ?? template?.title ?? "清单";

  if (!run && !template) {
    return (
      <section className="page narrow-page">
        <h1>找不到可分享内容</h1>
        <button className="primary-button" type="button" onClick={() => navigate(-1)}>返回</button>
      </section>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制可读文本。");
    } catch {
      setStatus("浏览器未允许自动复制，可从预览中手动选择文本。");
    }
  };

  const share = async () => {
    if (!("share" in navigator)) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: `别忘了：${title}`, text });
      setStatus("已打开系统分享面板。");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setStatus("系统分享不可用，可复制或下载文本。");
    }
  };

  return (
    <section className="page share-page">
      <button
        type="button"
        className="back-link button-link"
        onClick={() => navigate(-1)}
      ><ArrowLeft size={18} /> {run ? "返回历史详情" : "返回模板"}</button>
      <div className="share-layout">
        <aside className="share-controls">
          <p className="eyebrow">外发前先看清楚</p>
          <h1>分享预览</h1>
          {run ? (
            <fieldset className="projection-options">
              <legend>分享什么</legend>
              <label>
                <input
                  type="radio"
                  name="projection"
                  checked={projection === "checklist"}
                  onChange={() => setProjection("checklist")}
                /> 仅清单内容
              </label>
              <label>
                <input
                  type="radio"
                  name="projection"
                  checked={projection === "runResult"}
                  onChange={() => setProjection("runResult")}
                /> 本次处理结果
              </label>
              {projection === "runResult" ? (
                <label>
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(event) => setIncludeNotes(event.target.checked)}
                  /> 明确包含本次备注
                </label>
              ) : null}
            </fieldset>
          ) : null}
          <div className="privacy-callout">
            <Share2 aria-hidden="true" />
            <p>
              {run
                ? "默认不包含本次备注、未明确选择的历史信息或额外个人资料。"
                : "分享的是可读文本；不会生成需要账号或服务器维持的假链接。"}
            </p>
          </div>
          <div className="detail-action-stack">
            <button className="primary-button" type="button" onClick={() => void share()}>
              <Send size={18} /> 系统分享
            </button>
            <button className="secondary-button" type="button" onClick={() => void copy()}>
              <Clipboard size={18} /> 复制文本
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => fileDownload(text, `别忘了-${title}.txt`)}
            ><Download size={18} /> 下载 TXT</button>
          </div>
          {status ? <p className="operation-status" role="status">{status}</p> : null}
        </aside>
        <pre className="share-preview" data-testid="share-preview">{text}</pre>
      </div>
    </section>
  );
}
