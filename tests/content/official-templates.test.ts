import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileOfficialTemplates } from "../../scripts/compile-official-templates";

const root = new URL("../../", import.meta.url);
const markdown = readFileSync(
  fileURLToPath(new URL("docs/02_别忘了_官方模板内容库_V1.1.md", root)),
  "utf8",
);
const suppliedJson = readFileSync(
  fileURLToPath(new URL("contracts/official-templates.v1.1.json", root)),
  "utf8",
);

describe("official template content compiler", () => {
  it("deterministically reproduces the supplied machine contract", () => {
    const generated = `${JSON.stringify(compileOfficialTemplates(markdown), null, 2)}\n`;

    expect(generated).toBe(suppliedJson);
  });

  it("preserves all stable identities and featured positions", () => {
    const bundle = compileOfficialTemplates(markdown);
    const items = bundle.templates.flatMap((template) =>
      template.groups.flatMap((group) => group.items),
    );
    const templateIds = bundle.templates.map((template) => template.templateId);
    const itemIds = items.map((item) => item.itemId);
    const featuredOrders = bundle.templates
      .map((template) => template.featuredOrder)
      .filter((order): order is number => order !== null)
      .toSorted((left, right) => left - right);

    expect(bundle.templates).toHaveLength(13);
    expect(items).toHaveLength(244);
    expect(new Set(templateIds).size).toBe(13);
    expect(new Set(itemIds).size).toBe(244);
    expect(featuredOrders).toEqual([1, 2, 3, 4, 5, 6, 7]);

    for (const template of bundle.templates) {
      const groupIds = template.groups.map((group) => group.groupId);
      expect(new Set(groupIds).size).toBe(groupIds.length);
    }
  });
});
