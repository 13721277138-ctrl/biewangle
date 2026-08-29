import type { AppSnapshot } from "@biewangle/domain";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { browserRuntime, type AppRuntime } from "../app/runtime.js";
import type { AppCommand, AppRepository } from "./app-repository.js";
import { createInitialSnapshot } from "./initial-state.js";

interface AppStoreValue {
  snapshot: AppSnapshot;
  runtime: AppRuntime;
  repository: AppRepository;
  error: string | null;
  pending: boolean;
  commitCommand(command: AppCommand): Promise<AppSnapshot>;
  reload(): Promise<AppSnapshot>;
  clearError(): void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({
  repository,
  runtime = browserRuntime,
  children,
}: {
  repository: AppRepository;
  runtime?: AppRuntime;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reload = useCallback(async () => {
    const loaded = await repository.load();
    setSnapshot(loaded);
    return loaded;
  }, [repository]);

  useEffect(() => {
    let active = true;
    repository
      .initialize(createInitialSnapshot(runtime.now()))
      .then((loaded) => {
        if (active) setSnapshot(loaded);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "无法打开本地数据。");
        }
      });
    return () => {
      active = false;
    };
  }, [repository, runtime]);

  const commitCommand = useCallback(
    async (command: AppCommand) => {
      setPending(true);
      setError(null);
      try {
        const committed = await repository.commitCommand(command);
        setSnapshot(committed);
        return committed;
      } catch (cause) {
        const message =
          cause instanceof Error && cause.message.includes("未保存")
            ? cause.message
            : "未保存，请重试。";
        setError(message);
        throw cause;
      } finally {
        setPending(false);
      }
    },
    [repository],
  );

  const value = useMemo<AppStoreValue | null>(
    () =>
      snapshot
        ? {
            snapshot,
            runtime,
            repository,
            error,
            pending,
            commitCommand,
            reload,
            clearError: () => setError(null),
          }
        : null,
    [snapshot, runtime, repository, error, pending, commitCommand, reload],
  );

  if (!value) {
    return (
      <main className="loading-screen" aria-live="polite">
        <div className="brand-mark" aria-hidden="true">✓</div>
        <p>{error ?? "正在打开本地清单…"}</p>
      </main>
    );
  }

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreValue {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error("useAppStore must be used inside AppStoreProvider");
  return value;
}
