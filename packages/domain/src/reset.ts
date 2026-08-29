import type { AppSnapshot } from "./schema.js";

export interface PreparedReset {
  protectiveCopyLabel: "before-reset";
  sourceUpdatedAt: string;
  next: AppSnapshot;
}

export function prepareReset(
  current: AppSnapshot,
  now: string,
): PreparedReset {
  return {
    protectiveCopyLabel: "before-reset",
    sourceUpdatedAt: current.updatedAt,
    next: {
      schemaVersion: current.schemaVersion,
      minimumWriterVersion: current.minimumWriterVersion,
      appVersion: current.appVersion,
      officialContentVersion: current.officialContentVersion,
      personalTemplates: [],
      plannedChecks: [],
      checkRuns: [],
      settings: {
        favoriteTemplateIds: [],
        hiddenOfficialTemplateIds: [],
        backupNudgeDismissed: false,
      },
      updatedAt: now,
    },
  };
}
