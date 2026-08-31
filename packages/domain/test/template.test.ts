import { describe, expect, it } from "vitest";

import {
  derivePersonalTemplate,
  restorePersonalTemplate,
  softDeletePersonalTemplate,
} from "../src/template.js";
import { NOW, ONE_HOUR_LATER, officialTemplate } from "./fixtures.js";

describe("official and personal template governance", () => {
  it("[TPL-001] creates a personal derivative without mutating the official source", () => {
    const official = officialTemplate("official.daily_out");
    const original = structuredClone(official);
    const personal = derivePersonalTemplate(
      official,
      {
        title: "我的极简出门",
        groups: official.groups.slice(0, 1),
      },
      NOW,
      { personalTemplateId: "personal-derived" },
    );

    expect(personal).toMatchObject({
      personalTemplateId: "personal-derived",
      derivedFromTemplateId: official.templateId,
      derivedFromContentVersion: official.contentVersion,
      title: "我的极简出门",
    });
    expect(official).toEqual(original);
  });

  it("[TPL-002] treats official source metadata as explanatory only", () => {
    const officialV1 = officialTemplate("official.daily_out");
    const personal = derivePersonalTemplate(officialV1, {}, NOW, {
      personalTemplateId: "personal-stable",
    });
    const officialV2 = structuredClone(officialV1);
    officialV2.contentVersion = 2;
    officialV2.groups[0]!.items[0]!.title = "新版手机文案";

    expect(personal.groups[0]!.items[0]!.title).toBe("手机");
    expect(personal.derivedFromContentVersion).toBe(1);
    expect(officialV2.groups[0]!.items[0]!.title).not.toBe(
      personal.groups[0]!.items[0]!.title,
    );
  });

  it("[TPL-003] soft-deletes and restores only the personal copy", () => {
    const official = officialTemplate("official.business_trip");
    const officialBefore = structuredClone(official);
    const personal = derivePersonalTemplate(official, {}, NOW, {
      personalTemplateId: "personal-business",
    });
    const deleted = softDeletePersonalTemplate(personal, ONE_HOUR_LATER);
    const restored = restorePersonalTemplate(deleted, "2026-09-01T10:00:00.000+08:00");

    expect(deleted.deletedAt).toBe(ONE_HOUR_LATER);
    expect(restored.deletedAt).toBeUndefined();
    expect(restored.updatedAt).toBe("2026-09-01T10:00:00.000+08:00");
    expect(official).toEqual(officialBefore);
  });
});
