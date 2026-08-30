import {
  closeRun,
  createPlannedCheck,
  derivePersonalTemplate,
  exportBackup,
  serializeBackup,
  setOneTimeNote,
  startRun,
  type AppSnapshot,
} from "@biewangle/domain";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "./App.js";
import type { AppRuntime } from "./runtime.js";
import { officialTemplates } from "../content/official-content.js";
import { createInitialSnapshot } from "../data/initial-state.js";
import { MemoryAppRepository } from "../data/memory-repository.js";
import { AppStoreProvider } from "../data/use-app-store.js";

const NOW = "2026-09-01T08:00:00.000+08:00";

function runtime(): AppRuntime {
  let sequence = 0;
  return {
    now: () => NOW,
    localNow: () => ({ localDate: "2026-09-01", localTime: "08:00" }),
    timeZoneId: () => "Asia/Shanghai",
    newId: (kind) => `${kind}-full-${++sequence}`,
  };
}

function renderAt(
  route: string,
  initial: AppSnapshot = createInitialSnapshot(NOW),
) {
  const repository = new MemoryAppRepository(initial);
  render(
    <AppStoreProvider repository={repository} runtime={runtime()}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppStoreProvider>,
  );
  return repository;
}

function official(templateId: string) {
  const template = officialTemplates.find(
    (candidate) => candidate.templateId === templateId,
  );
  if (!template) throw new Error(`missing fixture ${templateId}`);
  return template;
}

describe("PWA complete V1 experience", () => {
  it("browses all 13 immutable official templates and persists favorite/hide choices", async () => {
    const user = userEvent.setup();
    const repository = renderAt("/templates");

    expect(await screen.findByRole("heading", { name: "模板库" })).toBeVisible();
    expect(screen.getAllByTestId("official-template-card")).toHaveLength(13);

    await user.click(screen.getByRole("button", { name: "收藏 日常出门" }));
    await user.click(screen.getByRole("button", { name: "隐藏 日常出门" }));

    const stored = await repository.load();
    expect(stored.settings.favoriteTemplateIds).toContain("official.daily_out");
    expect(stored.settings.hiddenOfficialTemplateIds).toContain(
      "official.daily_out",
    );
    expect(official("official.daily_out").title).toBe("日常出门");
  });

  it.each([
    ["护照", ["出国旅行"]],
    ["医保卡", ["住院准备", "重要就医"]],
    ["保险箱", ["离开酒店"]],
  ])("explains local search for %s", async (query, expectedTitles) => {
    const user = userEvent.setup();
    renderAt("/search");

    await user.type(await screen.findByRole("searchbox", { name: "搜索模板" }), query);
    for (const title of expectedTitles) {
      expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    }
    expect(screen.getByText(/仅在本机匹配/)).toBeVisible();
  });

  it("creates, soft-deletes, and restores a personal template without mutating official content", async () => {
    const user = userEvent.setup();
    const repository = renderAt("/templates/new");

    await user.type(await screen.findByLabelText("模板名称"), "晨间出门");
    await user.type(screen.getByLabelText("检查项（每行一项）"), "钥匙\n耳机");
    await user.click(screen.getByRole("button", { name: "保存个人模板" }));

    expect(await screen.findByRole("heading", { name: "模板库" })).toBeVisible();
    const personalCard = screen.getByTestId("personal-template-card");
    expect(personalCard).toHaveTextContent("晨间出门");
    await user.click(within(personalCard).getByRole("button", { name: "删除 晨间出门" }));
    await user.click(screen.getByRole("button", { name: "查看已删除模板" }));
    await user.click(screen.getByRole("button", { name: "恢复 晨间出门" }));

    const stored = await repository.load();
    expect(stored.personalTemplates).toHaveLength(1);
    expect(stored.personalTemplates[0]).not.toHaveProperty("deletedAt");
    expect(official("official.daily_out").title).toBe("日常出门");
  });

  it("keeps multiple runs distinct and cancels a pending frozen plan", async () => {
    const template = official("official.daily_out");
    const first = startRun(template, NOW, { checkRunId: "run-a" });
    const second = startRun(template, NOW, { checkRunId: "run-b" });
    const plan = createPlannedCheck(template, {
      plannedCheckId: "plan-a",
      scheduledDate: "2026-09-02",
      scheduledTime: "09:30",
      createdTimeZoneId: "Asia/Shanghai",
      now: NOW,
    });
    const initial = createInitialSnapshot(NOW, {
      checkRuns: [first, second],
      plannedChecks: [plan],
    });
    const user = userEvent.setup();
    const repository = renderAt("/runs", initial);

    expect(await screen.findByRole("heading", { name: "全部进行中" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: /继续 日常出门/ })).toHaveLength(2);
    await user.click(screen.getByRole("link", { name: "查看全部计划" }));
    await user.click(await screen.findByRole("button", { name: "取消计划 日常出门" }));

    expect((await repository.load()).plannedChecks[0]?.status).toBe("canceled");
    expect(screen.queryByText("2026-09-02 09:30")).not.toBeInTheDocument();
  });

  it("reopens a recent history run while retaining the close event and previews sharing without notes", async () => {
    const template = official("official.daily_out");
    let run = startRun(template, "2026-09-01T07:00:00.000+08:00", {
      checkRunId: "run-closed",
    });
    run = setOneTimeNote(
      run,
      run.items[0]!.runItemId,
      "私人备注不能默认分享",
      "2026-09-01T07:10:00.000+08:00",
    );
    const closed = closeRun(run, {
      intent: "endWithUnresolved",
      keyRiskConfirmed: true,
      now: "2026-09-01T07:30:00.000+08:00",
      closedEventId: "close-a",
    });
    if (closed.kind !== "endedWithUnresolved") throw new Error("bad fixture");
    const initial = createInitialSnapshot(NOW, { checkRuns: [closed.run] });
    const user = userEvent.setup();
    const repository = renderAt("/history/run-closed", initial);

    expect(await screen.findByRole("heading", { name: "日常出门" })).toBeVisible();
    await user.click(screen.getByRole("link", { name: "分享预览" }));
    const preview = await screen.findByTestId("share-preview");
    expect(preview).not.toHaveTextContent("私人备注不能默认分享");
    expect(screen.getByText(/默认不包含本次备注/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "返回历史详情" }));
    await user.click(await screen.findByRole("button", { name: "重开本次检查" }));

    const stored = await repository.load();
    expect(stored.checkRuns[0]).toMatchObject({
      status: "inProgress",
      reopenCount: 1,
      closedEvents: [{ closedEventId: "close-a" }],
    });
  });

  it("rejects a damaged restore without changing current data, then restores a valid envelope", async () => {
    const user = userEvent.setup();
    const currentPersonal = derivePersonalTemplate(
      official("official.daily_out"),
      { title: "当前模板" },
      NOW,
      { personalTemplateId: "personal-current" },
    );
    const current = createInitialSnapshot(NOW, {
      personalTemplates: [currentPersonal],
    });
    const replacement = createInitialSnapshot("2026-09-01T09:00:00.000+08:00", {
      settings: {
        favoriteTemplateIds: ["official.international_travel"],
        hiddenOfficialTemplateIds: [],
        backupNudgeDismissed: false,
      },
    });
    const repository = renderAt("/data", current);
    const input = await screen.findByLabelText("选择备份文件");

    await user.upload(input, new File(["{损坏"], "broken.json", { type: "application/json" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("当前数据未改变");
    expect((await repository.load()).personalTemplates[0]?.title).toBe("当前模板");

    const valid = serializeBackup(exportBackup(replacement, "pwa", NOW));
    await user.upload(input, new File([valid], "valid.json", { type: "application/json" }));
    await user.click(await screen.findByRole("button", { name: "确认整体恢复" }));

    expect(await screen.findByText("恢复完成，已替换当前本地数据。" )).toBeVisible();
    expect((await repository.load()).settings.favoriteTemplateIds).toEqual([
      "official.international_travel",
    ]);
    expect(repository.protectiveCopies.at(-1)?.label).toBe("before-restore");
  });
});
