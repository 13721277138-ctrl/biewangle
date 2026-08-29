import type { AppSnapshot } from "@biewangle/domain";

export function createInitialSnapshot(
  now: string,
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
    updatedAt: now,
    ...overrides,
  };
}
