import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const NOW = "2026-09-01T08:00:00.000+08:00";

interface ProjectedItem {
  groupTitle: string;
  isKey: boolean;
  runItemId: string;
  sourceItemId?: string;
  state: string;
}

interface ProjectedGroup {
  groupId: string;
  handledCount: number;
  itemCount: number;
  items: ProjectedItem[];
  renderKey: string;
  title: string;
}

interface RunProjection {
  allItems: ProjectedItem[];
  groups: ProjectedGroup[];
  keyCount: number;
  unresolvedCount: number;
  unresolvedKeyCount: number;
  visibleItems: ProjectedItem[];
}

function fixture() {
  const domain = require("../../miniprogram/lib/domain.js");
  const templates = require("../../miniprogram/generated/official-templates.js").templates;
  const template = templates.find(
    (candidate: { templateId: string }) => candidate.templateId === "official.daily_out",
  );
  const run = domain.startRun(template, NOW, { checkRunId: "run.visual-projection" });
  return { domain, run };
}

function projectRunView(run: Record<string, unknown>, viewMode: "all" | "key"): RunProjection {
  const module = require("../../miniprogram/lib/run-view.js") as {
    projectRunView: (candidate: Record<string, unknown>, mode: "all" | "key") => RunProjection;
  };
  return module.projectRunView(run, viewMode);
}

describe("native WeChat run presentation projection", () => {
  it("groups a daily run without changing its stable item order or identity", () => {
    const { run } = fixture();
    const before = structuredClone(run);

    const projection = projectRunView(run, "all");

    expect(projection.groups.map((group) => [group.title, group.itemCount])).toEqual([
      ["随身核心", 5],
      ["当天需要", 7],
    ]);
    expect(projection.visibleItems.map((item) => item.runItemId)).toEqual(
      run.items
        .slice()
        .sort((left: { runSortOrder: number }, right: { runSortOrder: number }) =>
          left.runSortOrder - right.runSortOrder)
        .map((item: { runItemId: string }) => item.runItemId),
    );
    expect(projection.unresolvedCount).toBe(12);
    expect(projection.unresolvedKeyCount).toBe(2);
    expect(run).toEqual(before);
  });

  it("keeps whole-run completion facts when only key items are visible", () => {
    const { run } = fixture();

    const projection = projectRunView(run, "key");

    expect(projection.visibleItems.map((item) => item.sourceItemId)).toEqual([
      "daily.phone",
      "daily.keys",
    ]);
    expect(projection.groups.map((group) => [group.title, group.itemCount])).toEqual([
      ["随身核心", 2],
    ]);
    expect(projection.keyCount).toBe(2);
    expect(projection.unresolvedCount).toBe(12);
    expect(projection.unresolvedKeyCount).toBe(2);
  });

  it("preserves an explicit global reorder even when a group becomes non-contiguous", () => {
    const { domain, run } = fixture();
    const orderedIds = run.items.map((item: { runItemId: string }) => item.runItemId);
    const firstTodayItem = orderedIds[5];
    const reorderedIds = [firstTodayItem, ...orderedIds.slice(0, 5), ...orderedIds.slice(6)];
    const reordered = domain.reorderRunItems(run, reorderedIds, "2026-09-01T08:01:00.000+08:00");

    const projection = projectRunView(reordered, "all");

    expect(projection.visibleItems.map((item) => item.runItemId)).toEqual(reorderedIds);
    expect(projection.groups.map((group) => group.title)).toEqual([
      "当天需要",
      "随身核心",
      "当天需要",
    ]);
  });
});
