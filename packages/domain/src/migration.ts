import {
  CURRENT_SCHEMA_VERSION,
  validateBusinessInvariants,
} from "./backup.js";
import { AppSnapshotSchema, type AppSnapshot } from "./schema.js";

export interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  migrate(input: unknown): unknown;
}

export type MigrationErrorCode =
  | "invalidSource"
  | "futureSchemaVersion"
  | "missingMigrationStep"
  | "migrationFailed"
  | "validationFailed";

export class MigrationError extends Error {
  constructor(
    public readonly code: MigrationErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "MigrationError";
  }
}

function readSchemaVersion(candidate: unknown): number {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("schemaVersion" in candidate) ||
    !Number.isInteger(candidate.schemaVersion)
  ) {
    throw new MigrationError(
      "invalidSource",
      "旧数据缺少可识别的 schemaVersion。",
    );
  }
  return candidate.schemaVersion as number;
}

export function migrateSnapshot(
  source: unknown,
  steps: readonly MigrationStep[],
): AppSnapshot {
  let candidate = structuredClone(source);
  let version = readSchemaVersion(candidate);
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      "futureSchemaVersion",
      `当前版本无法迁移 schemaVersion ${version}。`,
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = steps.find(
      (entry) =>
        entry.fromVersion === version && entry.toVersion === version + 1,
    );
    if (!step) {
      throw new MigrationError(
        "missingMigrationStep",
        `缺少 schemaVersion ${version} 到 ${version + 1} 的迁移。`,
      );
    }
    try {
      candidate = step.migrate(structuredClone(candidate));
    } catch (error) {
      throw new MigrationError(
        "migrationFailed",
        `schemaVersion ${version} 迁移失败。`,
        { cause: error },
      );
    }
    const migratedVersion = readSchemaVersion(candidate);
    if (migratedVersion !== step.toVersion) {
      throw new MigrationError(
        "migrationFailed",
        `迁移未生成声明的 schemaVersion ${step.toVersion}。`,
      );
    }
    version = migratedVersion;
  }

  try {
    return validateBusinessInvariants(AppSnapshotSchema.parse(candidate));
  } catch (error) {
    throw new MigrationError(
      "validationFailed",
      "迁移结果未通过当前 Schema 与业务校验。",
      { cause: error },
    );
  }
}
