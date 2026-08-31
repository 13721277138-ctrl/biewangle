import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const pageModulePath = require.resolve("../../miniprogram/pages/run/run.js");

function instantiatePage(definition: Record<string, any>) {
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
  });
  page.setData = (patch: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(patch)) {
      const segments = key.split(".");
      let target = page.data;
      for (const segment of segments.slice(0, -1)) target = target[segment];
      target[segments.at(-1)!] = value;
    }
  };
  return page;
}

afterEach(() => {
  delete require.cache[pageModulePath];
  vi.unstubAllGlobals();
});

describe("native WeChat closure receipt page", () => {
  it("stays on the run after durable completion and renders the persisted frozen receipt", async () => {
    const domain = require("../../miniprogram/lib/domain.js");
    const templates = require("../../miniprogram/generated/official-templates.js").templates;
    const template = templates.find(
      (candidate: { templateId: string }) => candidate.templateId === "official.daily_out",
    );
    let currentRun = domain.startRun(
      template,
      "2026-09-01T08:00:00.000+08:00",
      { checkRunId: "run.page-receipt" },
    );
    for (const item of currentRun.items) {
      currentRun = domain.toggleConfirmed(
        currentRun,
        item.runItemId,
        "2026-09-01T08:01:00.000+08:00",
      );
    }

    const redirectTo = vi.fn();
    const service = {
      getRun: () => domain.clone(currentRun),
      getRunClosureReceipt: () => domain.buildRunClosureReceipt(currentRun),
      closeRun: async (_checkRunId: string, _keyRiskConfirmed: boolean, intent: string) => {
        const result = domain.closeRun(currentRun, {
          intent,
          now: "2026-09-01T08:05:00.000+08:00",
          closedEventId: "closed.page-receipt",
        });
        if (result.run) currentRun = result.run;
        return domain.clone(result);
      },
    };
    vi.stubGlobal("getApp", () => ({ ready: Promise.resolve(), service }));
    vi.stubGlobal("wx", {
      redirectTo,
      reLaunch: vi.fn(),
      showModal: vi.fn(),
    });

    let definition: Record<string, any> | undefined;
    vi.stubGlobal("Page", (candidate: Record<string, any>) => {
      definition = candidate;
    });
    require(pageModulePath);
    const page = instantiatePage(definition!);
    page.onLoad({ id: encodeURIComponent(currentRun.checkRunId) });
    await page.onShow();
    expect(page.data.run.items[0].groupTitle).toBe(template.groups[0].title);
    await page.finishRun();

    expect(redirectTo).not.toHaveBeenCalled();
    expect(page.data.run).toMatchObject({
      status: "completed",
      closureReceipt: {
        kind: "completed",
        title: "这份清单已全部处理",
        message: "可以放心出发。",
      },
    });
  });

  it("binds the projected title and message into the native receipt view", () => {
    const markup = readFileSync(resolve("miniprogram/pages/run/run.wxml"), "utf8");
    expect(markup).toContain("{{run.closureReceipt.title}}");
    expect(markup).toContain("{{run.closureReceipt.message}}");
    expect(markup).toContain('bindtap="openHistoryFact"');
  });
});
