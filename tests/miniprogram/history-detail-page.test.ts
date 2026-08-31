import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const pageModulePath = require.resolve("../../miniprogram/pages/history-detail/history-detail.js");

function instantiatePage(definition: Record<string, any>) {
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
  });
  page.setData = (patch: Record<string, unknown>) => {
    Object.assign(page.data, patch);
  };
  return page;
}

afterEach(() => {
  delete require.cache[pageModulePath];
  vi.unstubAllGlobals();
});

describe("native WeChat history detail presentation", () => {
  it("projects frozen history items into the same ordered groups as Run", async () => {
    const domain = require("../../miniprogram/lib/domain.js");
    const templates = require("../../miniprogram/generated/official-templates.js").templates;
    const template = templates.find(
      (candidate: { templateId: string }) => candidate.templateId === "official.daily_out",
    );
    const run = domain.startRun(template, "2026-09-01T08:00:00.000+08:00", {
      checkRunId: "run.history-groups",
    });
    vi.stubGlobal("getApp", () => ({
      ready: Promise.resolve(),
      service: { getRun: () => domain.clone(run) },
    }));
    vi.stubGlobal("wx", {});
    let definition: Record<string, any> | undefined;
    vi.stubGlobal("Page", (candidate: Record<string, any>) => {
      definition = candidate;
    });
    require(pageModulePath);
    const page = instantiatePage(definition!);
    page.onLoad({ id: encodeURIComponent(run.checkRunId) });

    await page.onShow();

    expect(page.data.run.groups.map((group: { title: string; itemCount: number }) => [
      group.title,
      group.itemCount,
    ])).toEqual([
      ["随身核心", 5],
      ["当天需要", 7],
    ]);
    expect(page.data.run.items.map((item: { runItemId: string }) => item.runItemId)).toEqual(
      run.items.map((item: { runItemId: string }) => item.runItemId),
    );
  });
});
