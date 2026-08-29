import type { AppSnapshot } from "../src/schema.js";

export const SNAPSHOT_NOW = "2026-09-01T08:00:00.000+08:00";

export function appSnapshot(
  overrides: Partial<AppSnapshot> = {},
): AppSnapshot {
  return {
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
    updatedAt: SNAPSHOT_NOW,
    ...overrides,
  };
}
