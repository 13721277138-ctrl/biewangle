import type { AppSnapshot, CheckRunStatus } from "./schema.js";

function statusLabel(status: CheckRunStatus): string {
  if (status === "completed") return "已完成";
  if (status === "endedWithUnresolved") return "有未确认项结束";
  if (status === "discarded") return "已放弃";
  return "进行中";
}

export function buildReadableExport(snapshot: AppSnapshot): string {
  const lines = [
    "# 别忘了 · 人类可读导出",
    "",
    `导出数据更新时间：${snapshot.updatedAt}`,
    "",
    "## 个人模板",
  ];
  const activeTemplates = snapshot.personalTemplates.filter(
    (template) => !template.deletedAt,
  );
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
    lines.push(
      `- ${run.lastInteractedAt} · ${run.runTemplateSnapshot.title} · ${statusLabel(run.status)}`,
    );
  }
  lines.push("", "本文件便于阅读，不包含本次私密备注，也不用于完整恢复；恢复请使用 JSON 完整备份。");
  return lines.join("\n");
}
