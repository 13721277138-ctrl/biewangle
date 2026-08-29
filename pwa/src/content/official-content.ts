import {
  OfficialContentBundleSchema,
  type OfficialTemplate,
} from "@biewangle/domain";
import officialContentJson from "../../../shared-content/official-templates.v1.1.json";

const bundle = OfficialContentBundleSchema.parse(officialContentJson);

export const officialTemplates: readonly OfficialTemplate[] = bundle.templates;

export const VERTICAL_TEMPLATE_IDS = [
  "official.daily_out",
  "official.hotel_checkout",
  "official.international_travel",
  "official.important_medical_visit",
] as const;

const verticalTemplateIdSet = new Set<string>(VERTICAL_TEMPLATE_IDS);

export const verticalSliceTemplates = officialTemplates.filter((template) =>
  verticalTemplateIdSet.has(template.templateId),
);

export function findOfficialTemplate(templateId: string): OfficialTemplate {
  const template = officialTemplates.find(
    (candidate) => candidate.templateId === templateId,
  );
  if (!template) throw new Error(`找不到官方模板：${templateId}`);
  return template;
}
