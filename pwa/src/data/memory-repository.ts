import { validateBusinessInvariants, type AppSnapshot } from "@biewangle/domain";
import {
  DurableOperationError,
  assertWriterCompatible,
} from "@biewangle/persistence-contract";

import type { AppCommand, AppRepository } from "./app-repository.js";

export class MemoryAppRepository implements AppRepository {
  private snapshot: AppSnapshot;
  private nextFailure: unknown;
  readonly protectiveCopies: Array<{ label: string; snapshot: AppSnapshot }> = [];

  constructor(initial: AppSnapshot) {
    this.snapshot = validateBusinessInvariants(initial);
  }

  async initialize(): Promise<AppSnapshot> {
    return this.load();
  }

  async load(): Promise<AppSnapshot> {
    return structuredClone(this.snapshot);
  }

  failNextCommit(error: unknown): void {
    this.nextFailure = error;
  }

  async commitCommand(command: AppCommand): Promise<AppSnapshot> {
    assertWriterCompatible(this.snapshot, 1);
    let next: AppSnapshot;
    try {
      next = validateBusinessInvariants(
        command(structuredClone(this.snapshot)),
      );
    } catch (error) {
      throw new DurableOperationError(
        "mutation",
        "这次操作无法应用到当前数据。",
        { cause: error },
      );
    }
    if (this.nextFailure !== undefined) {
      const cause = this.nextFailure;
      this.nextFailure = undefined;
      throw new DurableOperationError(
        "commit",
        "未保存，请重试。",
        { cause },
      );
    }
    this.snapshot = structuredClone(next);
    return structuredClone(next);
  }

  async replaceSnapshot(candidate: AppSnapshot): Promise<AppSnapshot> {
    assertWriterCompatible(this.snapshot, 1);
    const next = validateBusinessInvariants(structuredClone(candidate));
    if (this.nextFailure !== undefined) {
      const cause = this.nextFailure;
      this.nextFailure = undefined;
      throw new DurableOperationError("commit", "未保存，请重试。", {
        cause,
      });
    }
    this.snapshot = structuredClone(next);
    return structuredClone(next);
  }

  async protectiveCopy(label: string): Promise<void> {
    this.protectiveCopies.push({
      label,
      snapshot: structuredClone(this.snapshot),
    });
  }
}
