import {
  parseAndValidateBackup,
  validateBusinessInvariants,
  type AppSnapshot,
  type PreparedReset,
} from "@biewangle/domain";

export interface DurableStore<T> {
  load(): Promise<T>;
  commit(next: T): Promise<void>;
  protectiveCopy(label: string): Promise<void>;
}

export type DurableOperation =
  | "load"
  | "mutation"
  | "protectiveCopy"
  | "commit"
  | "migration"
  | "writerCompatibility";

export class DurableOperationError extends Error {
  constructor(
    public readonly operation: DurableOperation,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DurableOperationError";
  }
}

async function loadDurably<T>(store: DurableStore<T>): Promise<T> {
  try {
    return await store.load();
  } catch (error) {
    throw new DurableOperationError("load", "无法读取当前本地数据。", {
      cause: error,
    });
  }
}

async function createProtectiveCopy<T>(
  store: DurableStore<T>,
  label: string,
): Promise<void> {
  try {
    await store.protectiveCopy(label);
  } catch (error) {
    throw new DurableOperationError(
      "protectiveCopy",
      "无法创建当前数据的保护副本，操作已停止。",
      { cause: error },
    );
  }
}

async function commitDurably<T>(
  store: DurableStore<T>,
  next: T,
): Promise<void> {
  try {
    await store.commit(next);
  } catch (error) {
    throw new DurableOperationError(
      "commit",
      "本地保存失败，未保存，请重试。",
      { cause: error },
    );
  }
}

export async function applyDurableMutation<T>(
  store: DurableStore<T>,
  mutate: (current: T) => T,
): Promise<T> {
  const current = await loadDurably(store);
  let next: T;
  try {
    next = mutate(structuredClone(current));
  } catch (error) {
    throw new DurableOperationError("mutation", "操作无法应用到当前数据。", {
      cause: error,
    });
  }
  await commitDurably(store, next);
  return structuredClone(next);
}

export async function restoreFromText(
  store: DurableStore<AppSnapshot>,
  raw: string,
): Promise<AppSnapshot> {
  await loadDurably(store);
  await createProtectiveCopy(store, "before-restore");
  const envelope = parseAndValidateBackup(raw);
  await commitDurably(store, envelope.data);
  return structuredClone(envelope.data);
}

export async function migrateDurably(
  store: DurableStore<AppSnapshot>,
  migrate: (current: AppSnapshot) => AppSnapshot,
): Promise<AppSnapshot> {
  const current = await loadDurably(store);
  await createProtectiveCopy(store, "before-migration");
  let candidate: AppSnapshot;
  try {
    candidate = validateBusinessInvariants(
      migrate(structuredClone(current)),
    );
  } catch (error) {
    throw new DurableOperationError(
      "migration",
      "数据升级失败，旧数据已保留。",
      { cause: error },
    );
  }
  await commitDurably(store, candidate);
  return structuredClone(candidate);
}

export async function resetDurably(
  store: DurableStore<AppSnapshot>,
  prepared: PreparedReset,
): Promise<AppSnapshot> {
  const current = await loadDurably(store);
  if (current.updatedAt !== prepared.sourceUpdatedAt) {
    throw new DurableOperationError(
      "mutation",
      "数据在重置确认后发生了变化，请重新确认。",
    );
  }
  await createProtectiveCopy(store, prepared.protectiveCopyLabel);
  const next = validateBusinessInvariants(prepared.next);
  await commitDurably(store, next);
  return structuredClone(next);
}

export function assertWriterCompatible(
  metadata: { minimumWriterVersion: number },
  writerVersion: number,
): void {
  if (metadata.minimumWriterVersion > writerVersion) {
    throw new DurableOperationError(
      "writerCompatibility",
      "本地数据由更新版本写入；当前版本已切换为只读，请刷新或升级。",
    );
  }
}
