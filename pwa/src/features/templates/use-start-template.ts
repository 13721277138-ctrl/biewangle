import { startRun, type StartableTemplate } from "@biewangle/domain";
import { useNavigate } from "react-router-dom";

import { useAppStore } from "../../data/use-app-store.js";

export function useStartTemplate() {
  const { runtime, commitCommand, pending } = useAppStore();
  const navigate = useNavigate();

  const startTemplate = async (template: StartableTemplate) => {
    const now = runtime.now();
    const checkRunId = runtime.newId("run");
    const run = startRun(template, now, { checkRunId });
    try {
      await commitCommand((current) => ({
        ...current,
        checkRuns: [...current.checkRuns, run],
        updatedAt: now,
      }));
      navigate(`/runs/${checkRunId}`);
    } catch {
      // AppStore exposes the durable error without publishing a speculative run.
    }
  };

  return { startTemplate, pending };
}
