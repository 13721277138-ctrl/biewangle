import {
  BackupValidationError,
  exportBackup,
  prepareReset,
  serializeBackup,
  type AppSnapshot,
} from "@biewangle/domain";
import { describe, expect, it } from "vitest";

import {
  DurableOperationError,
  applyDurableMutation,
  assertWriterCompatible,
  migrateDurably,
  resetDurably,
  restoreFromText,
  type DurableStore,
} from "../src/index.js";
import { appSnapshot, SNAPSHOT_NOW } from "../../domain/test/app-fixtures.js";

type FailurePoint = "load" | "protectiveCopy" | "commit";

class AtomicFakeStore implements DurableStore<AppSnapshot> {
  private durable: AppSnapshot;
  readonly protectiveCopies: Array<{ label: string; snapshot: AppSnapshot }> = [];
  readonly operations: string[] = [];
  failAt?: FailurePoint;
  commitFailureMessage = "write failed";

  constructor(initial: AppSnapshot) {
    this.durable = structuredClone(initial);
  }

  async load(): Promise<AppSnapshot> {
    this.operations.push("load");
    if (this.failAt === "load") throw new Error("open failed");
    return structuredClone(this.durable);
  }

  async protectiveCopy(label: string): Promise<void> {
    this.operations.push(`protectiveCopy:${label}`);
    if (this.failAt === "protectiveCopy") throw new Error("copy failed");
    this.protectiveCopies.push({
      label,
      snapshot: structuredClone(this.durable),
    });
  }

  async commit(next: AppSnapshot): Promise<void> {
    this.operations.push("commit");
    if (this.failAt === "commit") throw new Error(this.commitFailureMessage);
    this.durable = structuredClone(next);
  }

  inspect(): AppSnapshot {
    return structuredClone(this.durable);
  }
}

describe("durable persistence contract", () => {
  it.each<FailurePoint>(["load", "commit"])(
    "[DATA-001] exposes a %s failure and never publishes a false durable success",
    async (failurePoint) => {
      const current = appSnapshot();
      const store = new AtomicFakeStore(current);
      store.failAt = failurePoint;

      await expect(
        applyDurableMutation(store, (snapshot) => ({
          ...snapshot,
          updatedAt: "2026-09-01T09:00:00.000+08:00",
        })),
      ).rejects.toMatchObject({
        name: "DurableOperationError",
        operation: failurePoint,
      });
      expect(store.inspect()).toEqual(current);
    },
  );

  it.each(["write failed", "quota exceeded", "interrupted before slot switch"])(
    "keeps the durable truth on injected commit failure: %s",
    async (message) => {
      const current = appSnapshot();
      const store = new AtomicFakeStore(current);
      store.failAt = "commit";
      store.commitFailureMessage = message;

      await expect(
        applyDurableMutation(store, (snapshot) => ({
          ...snapshot,
          updatedAt: "2026-09-01T09:00:00.000+08:00",
        })),
      ).rejects.toMatchObject({ operation: "commit" });
      expect(store.inspect()).toEqual(current);
    },
  );

  it("[DATA-002] keeps current data when an imported backup is invalid", async () => {
    const current = appSnapshot();
    const store = new AtomicFakeStore(current);

    await expect(restoreFromText(store, "{not json")).rejects.toBeInstanceOf(
      BackupValidationError,
    );
    expect(store.inspect()).toEqual(current);
    expect(store.operations).toEqual(["load", "protectiveCopy:before-restore"]);
  });

  it("[DATA-003] rejects future backup formats before commit", async () => {
    const current = appSnapshot();
    const store = new AtomicFakeStore(current);
    const future = `${JSON.stringify({
      ...exportBackup(current, "pwa", SNAPSHOT_NOW),
      backupFormatVersion: 2,
    }, null, 2)}\n`;

    await expect(restoreFromText(store, future)).rejects.toMatchObject({
      code: "unsupportedBackupFormatVersion",
    });
    expect(store.inspect()).toEqual(current);
    expect(store.operations).not.toContain("commit");
  });

  it("[DATA-004] preserves the old snapshot if migration throws", async () => {
    const current = appSnapshot();
    const store = new AtomicFakeStore(current);

    await expect(
      migrateDurably(store, () => {
        throw new Error("migration failed");
      }),
    ).rejects.toMatchObject({
      name: "DurableOperationError",
      operation: "migration",
    });
    expect(store.inspect()).toEqual(current);
    expect(store.operations).toEqual(["load", "protectiveCopy:before-migration"]);
  });

  it("[DATA-005] creates the protective snapshot before destructive reset", async () => {
    const current = appSnapshot({
      settings: {
        favoriteTemplateIds: ["official.daily_out"],
        hiddenOfficialTemplateIds: [],
        backupNudgeDismissed: true,
      },
    });
    const store = new AtomicFakeStore(current);
    const prepared = prepareReset(current, "2026-09-01T12:00:00.000+08:00");

    const result = await resetDurably(store, prepared);

    expect(store.operations).toEqual([
      "load",
      "protectiveCopy:before-reset",
      "commit",
    ]);
    expect(store.protectiveCopies[0]!.snapshot).toEqual(current);
    expect(result).toEqual(prepared.next);
    expect(store.inspect()).toEqual(prepared.next);
  });

  it("refuses a stale reset confirmation when durable data changed meanwhile", async () => {
    const initial = appSnapshot();
    const prepared = prepareReset(initial, "2026-09-01T12:00:00.000+08:00");
    const changed = appSnapshot({
      updatedAt: "2026-09-01T11:59:00.000+08:00",
    });
    const store = new AtomicFakeStore(changed);

    await expect(resetDurably(store, prepared)).rejects.toMatchObject({
      operation: "mutation",
    });
    expect(store.operations).toEqual(["load"]);
    expect(store.inspect()).toEqual(changed);
  });

  it("wraps protective-copy and commit interruption failures in visible operation errors", async () => {
    const current = appSnapshot();
    const store = new AtomicFakeStore(current);
    store.failAt = "protectiveCopy";

    await expect(restoreFromText(store, serializeBackup(exportBackup(current, "pwa", SNAPSHOT_NOW))))
      .rejects.toBeInstanceOf(DurableOperationError);
    expect(store.inspect()).toEqual(current);
  });

  it("turns an older writer read-only before it can touch newer data", () => {
    expect(() =>
      assertWriterCompatible({ minimumWriterVersion: 2 }, 1),
    ).toThrowError(
      expect.objectContaining({
        name: "DurableOperationError",
        operation: "writerCompatibility",
      }),
    );
    expect(() =>
      assertWriterCompatible({ minimumWriterVersion: 1 }, 1),
    ).not.toThrow();
  });
});
