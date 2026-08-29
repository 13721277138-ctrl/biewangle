import { startRun } from "@biewangle/domain";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppRoutes } from "./App.js";
import { AppStoreProvider } from "../data/use-app-store.js";
import { createInitialSnapshot } from "../data/initial-state.js";
import { MemoryAppRepository } from "../data/memory-repository.js";
import { officialTemplates } from "../content/official-content.js";
import type { AppRuntime } from "./runtime.js";
import { UPDATE_READY_EVENT } from "./UpdatePrompt.js";

const NOW = "2026-09-01T08:00:00.000+08:00";

function runtime(): AppRuntime {
  let sequence = 0;
  return {
    now: () => NOW,
    localNow: () => ({ localDate: "2026-09-01", localTime: "08:00" }),
    timeZoneId: () => "Asia/Shanghai",
    newId: (kind) => `${kind}-${++sequence}`,
  };
}

function renderAt(
  route: string,
  repository = new MemoryAppRepository(createInitialSnapshot(NOW)),
) {
  render(
    <AppStoreProvider repository={repository} runtime={runtime()}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppStoreProvider>,
  );
  return repository;
}

describe("PWA trusted vertical slice", () => {
  it("starts a real run directly, persists three-state edits, and ends honestly", async () => {
    const user = userEvent.setup();
    const repository = renderAt("/");

    expect(
      await screen.findByRole("heading", { name: "今天，有什么要确认的？" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "开始 日常出门" }));

    const phoneRow = await screen.findByTestId("run-item-daily.phone");
    expect(screen.getByRole("heading", { name: "日常出门" })).toBeVisible();
    await user.click(within(phoneRow).getByRole("button", { name: "确认 手机" }));
    expect(
      within(phoneRow).getByRole("button", { name: "确认 手机" }),
    ).toHaveAttribute("aria-pressed", "true");

    const umbrellaRow = screen.getByTestId("run-item-daily.umbrella");
    await user.click(
      within(umbrellaRow).getByRole("button", { name: "本次不需要 雨伞" }),
    );
    expect(umbrellaRow).toHaveTextContent("本次不需要");

    await user.type(screen.getByLabelText("临时项目"), "门窗复查");
    await user.click(screen.getByRole("button", { name: "加入本次" }));
    expect(await screen.findByText("门窗复查")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "完成检查" }));
    expect(await screen.findByText(/仍有\d+项未确认/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "结束并保留" }));
    expect(
      await screen.findByRole("button", { name: "确认仍然结束" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "确认仍然结束" }));

    expect(
      await screen.findByRole("heading", { name: "本次检查已结束" }),
    ).toBeVisible();
    const snapshot = await repository.load();
    expect(snapshot.checkRuns).toHaveLength(1);
    expect(snapshot.checkRuns[0]).toMatchObject({
      status: "endedWithUnresolved",
      closedEvents: [{ type: "endedWithUnresolved" }],
    });
  });

  it("rolls the UI back and shows a visible error when durable commit fails", async () => {
    const user = userEvent.setup();
    const template = officialTemplates.find(
      (candidate) => candidate.templateId === "official.daily_out",
    )!;
    const run = startRun(template, NOW, { checkRunId: "run-existing" });
    const repository = new MemoryAppRepository(
      createInitialSnapshot(NOW, { checkRuns: [run] }),
    );
    repository.failNextCommit(new Error("quota exceeded"));
    renderAt("/runs/run-existing", repository);

    const button = await screen.findByRole("button", { name: "确认 手机" });
    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent("未保存，请重试");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect((await repository.load()).checkRuns[0]!.items[0]!.state).toBe(
      "unchecked",
    );
  });

  it("creates a frozen plan and can start it early from the home screen", async () => {
    const user = userEvent.setup();
    const repository = renderAt("/plans/new");

    await user.selectOptions(
      await screen.findByLabelText("检查场景"),
      "official.daily_out",
    );
    await user.type(screen.getByLabelText("日期"), "2026-09-30");
    await user.type(screen.getByLabelText("时间（可选）"), "18:30");
    await user.click(screen.getByRole("button", { name: "保存计划" }));

    expect(
      await screen.findByRole("heading", { name: "今天，有什么要确认的？" }),
    ).toBeVisible();
    expect(screen.getByText("2026-09-30 18:30")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "提前开始计划 日常出门" }),
    );
    await screen.findByTestId("run-item-daily.phone");
    expect(screen.getByRole("heading", { name: "日常出门" })).toBeVisible();

    const snapshot = await repository.load();
    expect(snapshot.plannedChecks[0]).toMatchObject({
      status: "consumed",
      startedCheckRunId: expect.any(String),
    });
    expect(snapshot.checkRuns[0]!.sourcePlannedCheckId).toBe(
      snapshot.plannedChecks[0]!.plannedCheckId,
    );
  });

  it("never forces a service-worker reload over an active run", async () => {
    const template = officialTemplates.find(
      (candidate) => candidate.templateId === "official.daily_out",
    )!;
    const run = startRun(template, NOW, { checkRunId: "run-active-update" });
    const repository = new MemoryAppRepository(
      createInitialSnapshot(NOW, { checkRuns: [run] }),
    );
    const activate = vi.fn(async () => undefined);
    renderAt("/runs/run-active-update", repository);
    await screen.findByTestId("run-item-daily.phone");

    act(() => {
      window.dispatchEvent(
        new CustomEvent(UPDATE_READY_EVENT, { detail: { activate } }),
      );
    });

    expect(
      screen.getByText(/当前检查会继续使用已加载版本/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "立即更新" }),
    ).not.toBeInTheDocument();
    expect(activate).not.toHaveBeenCalled();
  });
});
