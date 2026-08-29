import officialContentJson from "../../../shared-content/official-templates.v1.1.json";

import {
  OfficialContentBundleSchema,
  type CheckRun,
  type OfficialTemplate,
  type PersonalTemplate,
} from "../src/schema.js";

export const NOW = "2026-09-01T08:00:00.000+08:00";
export const ONE_HOUR_LATER = "2026-09-01T09:00:00.000+08:00";
export const THREE_HOURS_LATER = "2026-09-01T11:00:00.000+08:00";

export const officialContent =
  OfficialContentBundleSchema.parse(officialContentJson);

export function officialTemplate(templateId: string): OfficialTemplate {
  const template = officialContent.templates.find(
    (candidate) => candidate.templateId === templateId,
  );
  if (!template) {
    throw new Error(`Missing official template: ${templateId}`);
  }
  return structuredClone(template);
}

export function personalTemplate(
  overrides: Partial<PersonalTemplate> = {},
): PersonalTemplate {
  const source = officialTemplate("official.daily_out");
  return {
    personalTemplateId: "personal.daily-out",
    derivedFromTemplateId: source.templateId,
    derivedFromContentVersion: source.contentVersion,
    title: "我的日常出门",
    groups: structuredClone(source.groups),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function confirmEveryItem(
  run: CheckRun,
  toggle: (run: CheckRun, itemId: string, now: string) => CheckRun,
): CheckRun {
  return run.items.reduce(
    (current, item, index) =>
      toggle(
        current,
        item.runItemId,
        new Date(Date.parse(NOW) + index * 1000).toISOString(),
      ),
    run,
  );
}
