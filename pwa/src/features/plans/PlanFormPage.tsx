import { createPlannedCheck } from "@biewangle/domain";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { findOfficialTemplate, officialTemplates } from "../../content/official-content.js";
import { useAppStore } from "../../data/use-app-store.js";

export function PlanFormPage() {
  const { snapshot, runtime, commitCommand, pending } = useAppStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("template");
  const initialTemplateId = requested?.startsWith("official:")
    ? requested.slice("official:".length)
    : requested?.startsWith("personal:")
      ? requested
      : "official.daily_out";
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const now = runtime.now();
    const source = templateId.startsWith("personal:")
      ? snapshot.personalTemplates.find(
          (template) =>
            template.personalTemplateId === templateId.slice("personal:".length) &&
            !template.deletedAt,
        )
      : findOfficialTemplate(templateId);
    if (!source) return;
    const plannedCheck = createPlannedCheck(source, {
      plannedCheckId: runtime.newId("plan"),
      scheduledDate,
      ...(scheduledTime ? { scheduledTime } : {}),
      createdTimeZoneId: runtime.timeZoneId(),
      now,
    });
    try {
      await commitCommand((current) => ({
        ...current,
        plannedChecks: [...current.plannedChecks, plannedCheck],
        updatedAt: now,
      }));
      navigate("/");
    } catch {
      // The app-level alert reports the durable failure.
    }
  };

  return (
    <section className="page narrow-page">
      <Link to="/" className="back-link"><ArrowLeft size={18} /> 返回首页</Link>
      <div className="page-title-row">
        <span className="title-icon"><CalendarPlus aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">只为这一次</p>
          <h1>创建检查计划</h1>
        </div>
      </div>
      <p className="lede">计划会冻结当前模板内容。之后官方模板更新，也不会悄悄改掉这次安排。</p>
      <form className="form-card" onSubmit={(event) => void submit(event)}>
        <label>
          <span>检查场景</span>
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {officialTemplates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.title}
              </option>
            ))}
            {snapshot.personalTemplates
              .filter((template) => !template.deletedAt)
              .map((template) => (
                <option
                  key={template.personalTemplateId}
                  value={`personal:${template.personalTemplateId}`}
                >
                  我的 · {template.title}
                </option>
              ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            <span>日期</span>
            <input
              type="date"
              required
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
            />
          </label>
          <label>
            <span>时间（可选）</span>
            <input
              type="time"
              value={scheduledTime}
              onChange={(event) => setScheduledTime(event.target.value)}
            />
          </label>
        </div>
        <p className="form-help">日期与时间按本地日历原样保存；换时区后不会被换算成别的一天。</p>
        <button className="primary-button" type="submit" disabled={pending || !scheduledDate}>
          保存计划
        </button>
      </form>
    </section>
  );
}
