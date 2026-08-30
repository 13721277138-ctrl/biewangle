import type {
  OfficialTemplate,
  OfficialTemplateGroup,
  PersonalTemplate,
} from "@biewangle/domain";

export interface PersonalTemplateDraft {
  title: string;
  itemLines: string;
  icon: string;
  themeColor: string;
}

export const TEMPLATE_ICONS = ["check", "bag", "home", "heart", "briefcase"] as const;
export const TEMPLATE_COLORS = ["jade", "ocean", "clay", "plum", "graphite"] as const;

export function groupsToItemLines(groups: readonly OfficialTemplateGroup[]): string {
  return groups.flatMap((group) => group.items.map((item) => item.title)).join("\n");
}

export function draftFromTemplate(
  template?: OfficialTemplate | PersonalTemplate,
): PersonalTemplateDraft {
  const personal =
    template && "personalTemplateId" in template ? template : undefined;
  return {
    title: template?.title ?? "",
    itemLines: template ? groupsToItemLines(template.groups) : "",
    icon: personal?.icon ?? "check",
    themeColor: personal?.themeColor ?? "jade",
  };
}

export function buildEditableGroups(
  personalTemplateId: string,
  itemLines: string,
  existing: readonly OfficialTemplateGroup[] = [],
): OfficialTemplateGroup[] {
  const titles = itemLines
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (titles.length === 0) throw new Error("至少需要一个检查项。");
  const existingItems = existing.flatMap((group) => group.items);
  return [
    {
      groupId: existing[0]?.groupId ?? `${personalTemplateId}.group.main`,
      title: existing.length === 1 ? existing[0]!.title : "检查项",
      items: titles.map((title, index) => ({
        itemId:
          existingItems[index]?.itemId ??
          `${personalTemplateId}.item.${String(index + 1).padStart(3, "0")}`,
        importance: existingItems[index]?.importance ?? "normal",
        title,
        ...(existingItems[index]?.condition
          ? { condition: existingItems[index].condition }
          : {}),
        ...(existingItems[index]?.hint ? { hint: existingItems[index].hint } : {}),
      })),
    },
  ];
}
