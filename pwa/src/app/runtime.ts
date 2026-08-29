import type { LocalWallTime } from "@biewangle/domain";

export type RuntimeIdKind = "run" | "plan" | "temporary" | "close" | "personal";

export interface AppRuntime {
  now(): string;
  localNow(): LocalWallTime;
  timeZoneId(): string;
  newId(kind: RuntimeIdKind): string;
}

function pad(number: number): string {
  return String(number).padStart(2, "0");
}

export const browserRuntime: AppRuntime = {
  now: () => new Date().toISOString(),
  localNow: () => {
    const now = new Date();
    return {
      localDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      localTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  },
  timeZoneId: () =>
    Intl.DateTimeFormat().resolvedOptions().timeZone || "local-unknown",
  newId: (kind) => `${kind}.${crypto.randomUUID()}`,
};
