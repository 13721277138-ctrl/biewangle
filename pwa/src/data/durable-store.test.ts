import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { createInitialSnapshot } from "./initial-state.js";
import { DexieAppRepository } from "./durable-store.js";

const NOW = "2026-09-01T08:00:00.000+08:00";

describe("DexieAppRepository durable publication boundary", () => {
  it("persists one validated snapshot that another repository instance can read", async () => {
    const databaseName = `biewangle-test-${crypto.randomUUID()}`;
    const first = new DexieAppRepository(databaseName);
    const initial = createInitialSnapshot(NOW);
    await first.initialize(initial);
    const committed = await first.commitCommand((current) => ({
      ...current,
      updatedAt: "2026-09-01T09:00:00.000+08:00",
      settings: {
        ...current.settings,
        favoriteTemplateIds: ["official.daily_out"],
      },
    }));
    await first.close();

    const second = new DexieAppRepository(databaseName);
    expect(await second.load()).toEqual(committed);
    await second.deleteDatabase();
  });

  it("does not replace the durable snapshot when the transaction fails", async () => {
    const databaseName = `biewangle-test-${crypto.randomUUID()}`;
    const initial = createInitialSnapshot(NOW);
    const repository = new DexieAppRepository(databaseName, {
      beforeCommit: async () => {
        throw new Error("quota exceeded");
      },
    });
    await repository.initialize(initial);

    await expect(
      repository.commitCommand((current) => ({
        ...current,
        updatedAt: "2026-09-01T09:00:00.000+08:00",
      })),
    ).rejects.toMatchObject({ operation: "commit" });
    expect(await repository.load()).toEqual(initial);
    await repository.deleteDatabase();
  });
});
