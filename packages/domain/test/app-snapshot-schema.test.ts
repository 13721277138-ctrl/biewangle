import { describe, expect, it } from "vitest";
import {
  AppSnapshotSchema,
  PersonalTemplateSchema,
  PlannedCheckSchema,
} from "../src/schema";

const now = "2026-08-30T00:00:00.000Z";

describe("local-first aggregate schemas", () => {
  it("accepts a complete empty V1 snapshot", () => {
    const snapshot = AppSnapshotSchema.parse({
      schemaVersion: 1,
      minimumWriterVersion: 1,
      appVersion: "1.1.0",
      officialContentVersion: 1,
      personalTemplates: [],
      plannedChecks: [],
      checkRuns: [],
      settings: {
        favoriteTemplateIds: [],
        hiddenOfficialTemplateIds: [],
        backupNudgeDismissed: false,
      },
      updatedAt: now,
    });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.checkRuns).toEqual([]);
  });

  it("requires PlannedCheck to carry a frozen launch snapshot", () => {
    const result = PlannedCheckSchema.safeParse({
      plannedCheckId: "plan-1",
      status: "pending",
      scheduledDate: "2026-09-05",
      createdTimeZoneId: "Asia/Shanghai",
      sourceTemplateIdentity: {
        kind: "official",
        templateId: "official.daily_out",
        contentVersion: 1,
      },
      createdAt: now,
    });

    expect(result.success).toBe(false);
  });

  it("keeps official provenance on a personal derived copy", () => {
    const personal = PersonalTemplateSchema.parse({
      personalTemplateId: "personal-1",
      derivedFromTemplateId: "official.daily_out",
      derivedFromContentVersion: 1,
      title: "我的日常出门",
      groups: [
        {
          groupId: "core",
          title: "随身核心",
          items: [
            {
              itemId: "personal-1-phone",
              importance: "key",
              title: "手机",
            },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(personal.derivedFromTemplateId).toBe("official.daily_out");
    expect(personal.deletedAt).toBeUndefined();
  });
});
