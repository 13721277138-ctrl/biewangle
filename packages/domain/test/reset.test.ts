import { describe, expect, it } from "vitest";

import { prepareReset } from "../src/reset.js";
import { appSnapshot, SNAPSHOT_NOW } from "./app-fixtures.js";

describe("full reset preparation", () => {
  it("[DATA-005] prepares a protective-copy instruction before a clean snapshot", () => {
    const current = appSnapshot({
      settings: {
        favoriteTemplateIds: ["official.daily_out"],
        hiddenOfficialTemplateIds: ["official.hotel_checkout"],
        backupNudgeDismissed: true,
      },
      lastBackupAt: SNAPSHOT_NOW,
    });
    const original = structuredClone(current);
    const reset = prepareReset(current, "2026-09-01T12:00:00.000+08:00");

    expect(reset.protectiveCopyLabel).toBe("before-reset");
    expect(reset.next).toEqual(
      appSnapshot({ updatedAt: "2026-09-01T12:00:00.000+08:00" }),
    );
    expect(reset.next.lastBackupAt).toBeUndefined();
    expect(current).toEqual(original);
  });
});
