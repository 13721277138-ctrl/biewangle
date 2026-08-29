import { describe, expect, it } from "vitest";

import {
  BackupValidationError,
  exportBackup,
  parseAndValidateBackup,
  serializeBackup,
  validateBusinessInvariants,
} from "../src/backup.js";
import { appSnapshot, SNAPSHOT_NOW } from "./app-fixtures.js";

describe("Backup Envelope and restore candidate validation", () => {
  it("exports and parses the shared V1 envelope without changing the snapshot", () => {
    const snapshot = appSnapshot();
    const original = structuredClone(snapshot);
    const envelope = exportBackup(snapshot, "pwa", SNAPSHOT_NOW);
    const serialized = serializeBackup(envelope);

    expect(envelope).toMatchObject({
      productId: "biewangle",
      appVersion: "1.1.0",
      schemaVersion: 1,
      backupFormatVersion: 1,
      sourcePlatform: "pwa",
      officialContentVersion: 1,
      exportedAt: SNAPSHOT_NOW,
    });
    expect(parseAndValidateBackup(serialized)).toEqual(envelope);
    expect(snapshot).toEqual(original);
    expect(serialized.endsWith("\n")).toBe(true);
  });

  it.each([
    ["损坏 JSON", "{", "invalidJson"],
    [
      "错误产品",
      JSON.stringify({
        ...exportBackup(appSnapshot(), "pwa", SNAPSHOT_NOW),
        productId: "another-product",
      }),
      "productMismatch",
    ],
    [
      "未来备份格式",
      JSON.stringify({
        ...exportBackup(appSnapshot(), "pwa", SNAPSHOT_NOW),
        backupFormatVersion: 2,
      }),
      "unsupportedBackupFormatVersion",
    ],
    [
      "未来数据结构",
      JSON.stringify({
        ...exportBackup(appSnapshot(), "pwa", SNAPSHOT_NOW),
        schemaVersion: 2,
      }),
      "unsupportedSchemaVersion",
    ],
  ])("rejects %s with a stable visible code", (_title, raw, expectedCode) => {
    expect(() => parseAndValidateBackup(raw)).toThrow(BackupValidationError);
    try {
      parseAndValidateBackup(raw);
    } catch (error) {
      expect(error).toMatchObject({ code: expectedCode });
    }
  });

  it("rejects business-invalid duplicates even when the JSON schema shape is valid", () => {
    const template = {
      personalTemplateId: "personal-duplicate",
      title: "个人模板",
      groups: [
        {
          groupId: "group",
          title: "分组",
          items: [
            { itemId: "same", title: "A", importance: "normal" as const },
            { itemId: "same", title: "B", importance: "normal" as const },
          ],
        },
      ],
      createdAt: SNAPSHOT_NOW,
      updatedAt: SNAPSHOT_NOW,
    };
    const candidate = appSnapshot({ personalTemplates: [template] });

    expect(() => validateBusinessInvariants(candidate)).toThrowError(
      expect.objectContaining({ code: "businessInvariantViolation" }),
    );
  });
});
