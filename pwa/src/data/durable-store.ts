import Dexie, { type Table } from "dexie";
import { validateBusinessInvariants, type AppSnapshot } from "@biewangle/domain";
import {
  DurableOperationError,
  assertWriterCompatible,
} from "@biewangle/persistence-contract";

import type { AppCommand, AppRepository } from "./app-repository.js";

interface SnapshotRecord {
  id: "primary";
  value: AppSnapshot;
}

interface ProtectiveCopyRecord {
  id?: number;
  label: string;
  createdAt: string;
  value: AppSnapshot;
}

class BiewangleDatabase extends Dexie {
  snapshots!: Table<SnapshotRecord, "primary">;
  protectiveCopies!: Table<ProtectiveCopyRecord, number>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      snapshots: "id",
      protectiveCopies: "++id,label,createdAt",
    });
  }
}

export interface DexieRepositoryHooks {
  beforeCommit?: (next: AppSnapshot) => Promise<void> | void;
}

export class DexieAppRepository implements AppRepository {
  private readonly database: BiewangleDatabase;

  constructor(
    private readonly databaseName = "biewangle-v1",
    private readonly hooks: DexieRepositoryHooks = {},
  ) {
    this.database = new BiewangleDatabase(databaseName);
  }

  async initialize(initial: AppSnapshot): Promise<AppSnapshot> {
    try {
      await this.database.transaction(
        "rw",
        this.database.snapshots,
        async () => {
          const existing = await this.database.snapshots.get("primary");
          if (!existing) {
            await this.database.snapshots.put({
              id: "primary",
              value: validateBusinessInvariants(initial),
            });
          }
        },
      );
      return await this.load();
    } catch (error) {
      if (error instanceof DurableOperationError) throw error;
      throw new DurableOperationError(
        "load",
        "无法打开本地数据，请重试。",
        { cause: error },
      );
    }
  }

  async load(): Promise<AppSnapshot> {
    try {
      const record = await this.database.snapshots.get("primary");
      if (!record) {
        throw new Error("primary snapshot is missing");
      }
      assertWriterCompatible(record.value, 1);
      return validateBusinessInvariants(record.value);
    } catch (error) {
      if (error instanceof DurableOperationError) throw error;
      throw new DurableOperationError(
        "load",
        "无法读取本地数据，请重试。",
        { cause: error },
      );
    }
  }

  async commitCommand(command: AppCommand): Promise<AppSnapshot> {
    try {
      return await this.database.transaction(
        "rw",
        this.database.snapshots,
        async () => {
          const record = await this.database.snapshots.get("primary");
          if (!record) throw new Error("primary snapshot is missing");
          assertWriterCompatible(record.value, 1);
          const next = validateBusinessInvariants(
            command(structuredClone(record.value)),
          );
          await this.hooks.beforeCommit?.(structuredClone(next));
          await this.database.snapshots.put({ id: "primary", value: next });
          return structuredClone(next);
        },
      );
    } catch (error) {
      if (
        error instanceof DurableOperationError &&
        error.operation === "writerCompatibility"
      ) {
        throw error;
      }
      throw new DurableOperationError(
        "commit",
        "未保存，请重试。",
        { cause: error },
      );
    }
  }

  async replaceSnapshot(candidate: AppSnapshot): Promise<AppSnapshot> {
    try {
      return await this.database.transaction(
        "rw",
        this.database.snapshots,
        async () => {
          const current = await this.database.snapshots.get("primary");
          if (!current) throw new Error("primary snapshot is missing");
          assertWriterCompatible(current.value, 1);
          const next = validateBusinessInvariants(structuredClone(candidate));
          await this.hooks.beforeCommit?.(structuredClone(next));
          await this.database.snapshots.put({ id: "primary", value: next });
          return structuredClone(next);
        },
      );
    } catch (error) {
      if (
        error instanceof DurableOperationError &&
        error.operation === "writerCompatibility"
      ) {
        throw error;
      }
      throw new DurableOperationError(
        "commit",
        "未保存，请重试。",
        { cause: error },
      );
    }
  }

  async protectiveCopy(label: string): Promise<void> {
    try {
      await this.database.transaction(
        "rw",
        this.database.snapshots,
        this.database.protectiveCopies,
        async () => {
          const current = await this.database.snapshots.get("primary");
          if (!current) throw new Error("primary snapshot is missing");
          await this.database.protectiveCopies.add({
            label,
            createdAt: new Date().toISOString(),
            value: validateBusinessInvariants(current.value),
          });
        },
      );
    } catch (error) {
      throw new DurableOperationError(
        "protectiveCopy",
        "无法创建本地保护副本，操作已停止。",
        { cause: error },
      );
    }
  }

  async close(): Promise<void> {
    this.database.close();
  }

  async deleteDatabase(): Promise<void> {
    this.database.close();
    await Dexie.delete(this.databaseName);
  }
}
