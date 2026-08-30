import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { validateBusinessInvariants, type AppSnapshot } from "../../packages/domain/src/index";
import { appSnapshot } from "../../packages/domain/test/app-fixtures";

const require = createRequire(import.meta.url);

type StoredValue = unknown;

class FakeStorage {
  readonly values = new Map<string, StoredValue>();
  private failingGetKey: string | undefined;
  private failingSetKey: string | undefined;

  failNextGet(key: string) {
    this.failingGetKey = key;
  }

  failNextSet(key: string) {
    this.failingSetKey = key;
  }

  async get(key: string): Promise<StoredValue | undefined> {
    if (this.failingGetKey === key) {
      this.failingGetKey = undefined;
      throw new Error("read interrupted");
    }
    return structuredClone(this.values.get(key));
  }

  async set(key: string, value: StoredValue): Promise<void> {
    if (this.failingSetKey === key) {
      this.failingSetKey = undefined;
      throw new Error("quota exceeded");
    }
    this.values.set(key, structuredClone(value));
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function loadStoreModule(): {
  WechatDurableStore: new (options: {
    storage: FakeStorage;
    validate: (candidate: AppSnapshot) => AppSnapshot;
    createInitial: () => AppSnapshot;
  }) => {
    commit(next: AppSnapshot): Promise<void>;
    load(): Promise<AppSnapshot>;
  };
  STORAGE_KEYS: { active: string; slotA: string; slotB: string };
} {
  return require("../../miniprogram/lib/store.js");
}

describe("WechatDurableStore", () => {
  it("writes and verifies the inactive slot before switching the active pointer", async () => {
    const { WechatDurableStore, STORAGE_KEYS } = loadStoreModule();
    const storage = new FakeStorage();
    const store = new WechatDurableStore({
      storage,
      validate: validateBusinessInvariants,
      createInitial: () => appSnapshot(),
    });
    const first = appSnapshot({ updatedAt: "2026-09-01T08:01:00.000+08:00" });
    const second = appSnapshot({ updatedAt: "2026-09-01T08:02:00.000+08:00" });

    await store.commit(first);
    expect(storage.values.get(STORAGE_KEYS.active)).toBe("a");
    expect(storage.values.get(STORAGE_KEYS.slotA)).toEqual(first);

    await store.commit(second);
    expect(storage.values.get(STORAGE_KEYS.active)).toBe("b");
    expect(storage.values.get(STORAGE_KEYS.slotB)).toEqual(second);
    expect(await store.load()).toEqual(second);
  });

  it("keeps the previous durable snapshot active when the inactive write fails", async () => {
    const { WechatDurableStore, STORAGE_KEYS } = loadStoreModule();
    const storage = new FakeStorage();
    const store = new WechatDurableStore({
      storage,
      validate: validateBusinessInvariants,
      createInitial: () => appSnapshot(),
    });
    const previous = appSnapshot({ updatedAt: "2026-09-01T08:03:00.000+08:00" });
    const next = appSnapshot({ updatedAt: "2026-09-01T08:04:00.000+08:00" });
    await store.commit(previous);
    storage.failNextSet(STORAGE_KEYS.slotB);

    await expect(store.commit(next)).rejects.toThrow("本地保存失败");

    expect(storage.values.get(STORAGE_KEYS.active)).toBe("a");
    expect(await store.load()).toEqual(previous);
  });

  it("keeps the previous snapshot active when verification of the inactive slot is interrupted", async () => {
    const { WechatDurableStore, STORAGE_KEYS } = loadStoreModule();
    const storage = new FakeStorage();
    const store = new WechatDurableStore({
      storage,
      validate: validateBusinessInvariants,
      createInitial: () => appSnapshot(),
    });
    const previous = appSnapshot({ updatedAt: "2026-09-01T08:05:00.000+08:00" });
    const next = appSnapshot({ updatedAt: "2026-09-01T08:06:00.000+08:00" });
    await store.commit(previous);
    storage.failNextGet(STORAGE_KEYS.slotB);

    await expect(store.commit(next)).rejects.toThrow("本地保存失败");

    expect(storage.values.get(STORAGE_KEYS.active)).toBe("a");
    expect(await store.load()).toEqual(previous);
  });

  it("keeps the previous snapshot active when switching the pointer fails", async () => {
    const { WechatDurableStore, STORAGE_KEYS } = loadStoreModule();
    const storage = new FakeStorage();
    const store = new WechatDurableStore({
      storage,
      validate: validateBusinessInvariants,
      createInitial: () => appSnapshot(),
    });
    const previous = appSnapshot({ updatedAt: "2026-09-01T08:07:00.000+08:00" });
    const next = appSnapshot({ updatedAt: "2026-09-01T08:08:00.000+08:00" });
    await store.commit(previous);
    storage.failNextSet(STORAGE_KEYS.active);

    await expect(store.commit(next)).rejects.toThrow("本地保存失败");

    expect(storage.values.get(STORAGE_KEYS.active)).toBe("a");
    expect(await store.load()).toEqual(previous);
  });

  it("falls back to the previous valid slot when the active slot is corrupt", async () => {
    const { WechatDurableStore, STORAGE_KEYS } = loadStoreModule();
    const storage = new FakeStorage();
    const store = new WechatDurableStore({
      storage,
      validate: validateBusinessInvariants,
      createInitial: () => appSnapshot(),
    });
    const previous = appSnapshot({ updatedAt: "2026-09-01T08:09:00.000+08:00" });
    const latest = appSnapshot({ updatedAt: "2026-09-01T08:10:00.000+08:00" });
    await store.commit(previous);
    await store.commit(latest);
    storage.values.set(STORAGE_KEYS.slotB, { schemaVersion: 999 });

    expect(storage.values.get(STORAGE_KEYS.active)).toBe("b");
    expect(await store.load()).toEqual(previous);
  });

  it("does not write any slot when the candidate fails validation", async () => {
    const { WechatDurableStore, STORAGE_KEYS } = loadStoreModule();
    const storage = new FakeStorage();
    const store = new WechatDurableStore({
      storage,
      validate: validateBusinessInvariants,
      createInitial: () => appSnapshot(),
    });

    await expect(
      store.commit({ ...appSnapshot(), schemaVersion: 999 } as unknown as AppSnapshot),
    ).rejects.toThrow("本地保存失败");

    expect(storage.values.has(STORAGE_KEYS.active)).toBe(false);
    expect(storage.values.has(STORAGE_KEYS.slotA)).toBe(false);
    expect(storage.values.has(STORAGE_KEYS.slotB)).toBe(false);
  });

  it("returns a validated fresh snapshot when no active pointer exists", async () => {
    const { WechatDurableStore } = loadStoreModule();
    const storage = new FakeStorage();
    const initial = appSnapshot({ updatedAt: "2026-09-01T08:11:00.000+08:00" });
    const store = new WechatDurableStore({
      storage,
      validate: validateBusinessInvariants,
      createInitial: () => initial,
    });

    expect(await store.load()).toEqual(initial);
  });
});
