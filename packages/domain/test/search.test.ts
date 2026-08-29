import { describe, expect, it } from "vitest";

import { SEARCH_WEIGHTS, searchTemplates } from "../src/search.js";
import { officialContent } from "./fixtures.js";

describe("weighted local template search", () => {
  it("keeps literal field precedence in one auditable constant", () => {
    expect(SEARCH_WEIGHTS).toEqual({
      title: 500,
      aliases: 400,
      itemTitle: 300,
      applicability: 200,
      hint: 100,
    });
  });

  it("[SEARCH-001] finds international travel for 护照", () => {
    expect(
      searchTemplates(officialContent.templates, "护照").map(
        (result) => result.template.templateId,
      ),
    ).toContain("official.international_travel");
  });

  it("[SEARCH-002] finds both fixed medical templates for 医保卡", () => {
    const ids = searchTemplates(officialContent.templates, "医保卡").map(
      (result) => result.template.templateId,
    );
    expect(ids).toContain("official.hospital_admission");
    expect(ids).toContain("official.important_medical_visit");
  });

  it("[SEARCH-003] finds hotel checkout for 保险箱", () => {
    expect(
      searchTemplates(officialContent.templates, "保险箱").map(
        (result) => result.template.templateId,
      ),
    ).toContain("official.hotel_checkout");
  });

  it("ranks a title hit above aliases, items, applicability and hints", () => {
    const makeTemplate = (
      templateId: string,
      field: "title" | "alias" | "item" | "applicability" | "hint",
    ) => ({
      templateId: `official.${templateId}`,
      contentVersion: 1,
      title: field === "title" ? "测试针" : `模板${templateId}`,
      applicability: field === "applicability" ? "测试针" : "其他场景",
      targetDurationSec: [20, 30] as [number, number],
      searchAliases: field === "alias" ? ["测试针"] : ["别名"],
      featuredOrder: null,
      editorialIntent: "测试",
      groups: [
        {
          groupId: "g",
          title: "分组",
          items: [
            {
              itemId: `${templateId}.item`,
              title: field === "item" ? "测试针" : "项目",
              importance: "normal" as const,
              ...(field === "hint" ? { hint: "测试针" } : {}),
            },
          ],
        },
      ],
    });
    const results = searchTemplates(
      [
        makeTemplate("hint", "hint"),
        makeTemplate("app", "applicability"),
        makeTemplate("item", "item"),
        makeTemplate("alias", "alias"),
        makeTemplate("title", "title"),
      ],
      "测试针",
    );

    expect(results.map((result) => result.template.templateId)).toEqual([
      "official.title",
      "official.alias",
      "official.item",
      "official.app",
      "official.hint",
    ]);
  });
});
