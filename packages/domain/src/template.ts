import type {
  OfficialTemplate,
  PersonalTemplate,
} from "./schema.js";

export interface PersonalTemplateEdits {
  title?: string;
  groups?: OfficialTemplate["groups"];
  icon?: string;
  themeColor?: string;
}

export function derivePersonalTemplate(
  official: OfficialTemplate,
  edits: PersonalTemplateEdits,
  now: string,
  options: { personalTemplateId: string },
): PersonalTemplate {
  return {
    personalTemplateId: options.personalTemplateId,
    derivedFromTemplateId: official.templateId,
    derivedFromContentVersion: official.contentVersion,
    title: edits.title ?? official.title,
    groups: structuredClone(edits.groups ?? official.groups),
    ...(edits.icon ? { icon: edits.icon } : {}),
    ...(edits.themeColor ? { themeColor: edits.themeColor } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function softDeletePersonalTemplate(
  template: PersonalTemplate,
  now: string,
): PersonalTemplate {
  return { ...template, deletedAt: now, updatedAt: now };
}

export function restorePersonalTemplate(
  template: PersonalTemplate,
  now: string,
): PersonalTemplate {
  const { deletedAt: _deletedAt, ...active } = template;
  return { ...active, updatedAt: now };
}
