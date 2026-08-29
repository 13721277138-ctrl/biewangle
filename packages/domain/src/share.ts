import type { CheckRun, CheckRunItemState } from "./schema.js";

export interface SharePreview {
  kind: "checklist" | "runResult";
  text: string;
  included: Array<"title" | "groups" | "itemTitles" | "itemState" | "oneTimeNote">;
  excluded: Array<"itemState" | "oneTimeNote" | "history">;
}

export type SharePreviewOptions =
  | { kind: "checklist" }
  | { kind: "runResult"; includeOneTimeNotes?: boolean };

const STATE_LABELS: Record<CheckRunItemState, string> = {
  unchecked: "未确认",
  confirmed: "已确认",
  notNeeded: "本次不需要",
};

export function buildSharePreview(
  run: CheckRun,
  options: SharePreviewOptions,
): SharePreview {
  const groupTitles = new Map(
    run.runTemplateSnapshot.groups.map((group) => [group.groupId, group.title]),
  );
  const lines = [`# ${run.runTemplateSnapshot.title}`];
  let previousGroupId: string | undefined;
  const items = [...run.items].sort(
    (left, right) => left.runSortOrder - right.runSortOrder,
  );

  for (const item of items) {
    if (item.groupId !== previousGroupId) {
      lines.push("", `## ${groupTitles.get(item.groupId) ?? "本次临时项"}`);
      previousGroupId = item.groupId;
    }
    const state = options.kind === "runResult" ? `[${STATE_LABELS[item.state]}] ` : "";
    lines.push(`- ${state}${item.title}`);
    if (
      options.kind === "runResult" &&
      options.includeOneTimeNotes === true &&
      item.oneTimeNote
    ) {
      lines.push(`  - 本次备注：${item.oneTimeNote}`);
    }
  }

  if (options.kind === "checklist") {
    return {
      kind: "checklist",
      text: lines.join("\n"),
      included: ["title", "groups", "itemTitles"],
      excluded: ["itemState", "oneTimeNote", "history"],
    };
  }

  const includesNotes = options.includeOneTimeNotes === true;
  return {
    kind: "runResult",
    text: lines.join("\n"),
    included: [
      "title",
      "groups",
      "itemTitles",
      "itemState",
      ...(includesNotes ? (["oneTimeNote"] as const) : []),
    ],
    excluded: [
      ...(!includesNotes ? (["oneTimeNote"] as const) : []),
      "history",
    ],
  };
}
