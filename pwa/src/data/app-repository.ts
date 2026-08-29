import type { AppSnapshot } from "@biewangle/domain";

export type AppCommand = (current: AppSnapshot) => AppSnapshot;

export interface AppRepository {
  initialize(initial: AppSnapshot): Promise<AppSnapshot>;
  load(): Promise<AppSnapshot>;
  commitCommand(command: AppCommand): Promise<AppSnapshot>;
  protectiveCopy(label: string): Promise<void>;
}
