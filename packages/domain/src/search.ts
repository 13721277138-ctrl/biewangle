import type { OfficialTemplate } from "./schema.js";

export const SEARCH_WEIGHTS = Object.freeze({
  title: 500,
  aliases: 400,
  itemTitle: 300,
  applicability: 200,
  hint: 100,
});

export type SearchMatchField = keyof typeof SEARCH_WEIGHTS;

export interface TemplateSearchResult {
  template: OfficialTemplate;
  score: number;
  matches: SearchMatchField[];
}

function includesQuery(value: string | undefined, query: string): boolean {
  return value?.toLocaleLowerCase("zh-CN").includes(query) ?? false;
}

export function searchTemplates(
  templates: readonly OfficialTemplate[],
  rawQuery: string,
): TemplateSearchResult[] {
  const query = rawQuery.trim().toLocaleLowerCase("zh-CN");
  if (!query) return [];

  return templates
    .map((template): TemplateSearchResult | undefined => {
      const matches: SearchMatchField[] = [];
      if (includesQuery(template.title, query)) matches.push("title");
      if (
        template.searchAliases.some((alias) => includesQuery(alias, query))
      ) {
        matches.push("aliases");
      }
      const items = template.groups.flatMap((group) => group.items);
      if (items.some((item) => includesQuery(item.title, query))) {
        matches.push("itemTitle");
      }
      if (includesQuery(template.applicability, query)) {
        matches.push("applicability");
      }
      if (items.some((item) => includesQuery(item.hint, query))) {
        matches.push("hint");
      }
      if (matches.length === 0) return undefined;
      return {
        template: structuredClone(template),
        score: Math.max(...matches.map((field) => SEARCH_WEIGHTS[field])),
        matches,
      };
    })
    .filter((result): result is TemplateSearchResult => result !== undefined)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.template.featuredOrder ?? Number.POSITIVE_INFINITY) -
          (right.template.featuredOrder ?? Number.POSITIVE_INFINITY) ||
        left.template.title.localeCompare(right.template.title, "zh-CN") ||
        left.template.templateId.localeCompare(right.template.templateId),
    );
}
