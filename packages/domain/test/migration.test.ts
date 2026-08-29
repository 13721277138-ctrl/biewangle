import { describe, expect, it } from "vitest";

import {
  MigrationError,
  migrateSnapshot,
  type MigrationStep,
} from "../src/migration.js";
import { appSnapshot, SNAPSHOT_NOW } from "./app-fixtures.js";

describe("staged schema migration", () => {
  it("validates and clones an already-current snapshot", () => {
    const current = appSnapshot();
    const migrated = migrateSnapshot(current, []);

    expect(migrated).toEqual(current);
    expect(migrated).not.toBe(current);
  });

  it("applies consecutive registered steps then validates the V1 result", () => {
    const legacy = {
      ...appSnapshot(),
      schemaVersion: 0,
      minimumWriterVersion: 0,
    };
    const step: MigrationStep = {
      fromVersion: 0,
      toVersion: 1,
      migrate: (input) => ({
        ...(input as Record<string, unknown>),
        schemaVersion: 1,
        minimumWriterVersion: 1,
        updatedAt: SNAPSHOT_NOW,
      }),
    };

    expect(migrateSnapshot(legacy, [step])).toEqual(appSnapshot());
    expect(legacy.schemaVersion).toBe(0);
  });

  it.each([
    ["futureSchemaVersion", { ...appSnapshot(), schemaVersion: 2 }, []],
    ["missingMigrationStep", { ...appSnapshot(), schemaVersion: 0 }, []],
    [
      "migrationFailed",
      { ...appSnapshot(), schemaVersion: 0 },
      [
        {
          fromVersion: 0,
          toVersion: 1,
          migrate: () => {
            throw new Error("boom");
          },
        },
      ],
    ],
  ])("surfaces %s without mutating the input", (expectedCode, input, steps) => {
    const original = structuredClone(input);
    expect(() => migrateSnapshot(input, steps as MigrationStep[])).toThrow(
      MigrationError,
    );
    try {
      migrateSnapshot(input, steps as MigrationStep[]);
    } catch (error) {
      expect(error).toMatchObject({ code: expectedCode });
    }
    expect(input).toEqual(original);
  });
});
