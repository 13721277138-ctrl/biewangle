import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import { validateBusinessInvariants, type AppSnapshot } from "../../packages/domain/src/index";
import { appSnapshot } from "../../packages/domain/test/app-fixtures";

const require = createRequire(import.meta.url);
const content = require("../../miniprogram/generated/official-templates.js");

class MemoryStorage {
  readonly values = new Map<string, unknown>();
  failWrites = false;

  async get(key: string) {
    return structuredClone(this.values.get(key));
  }

  async set(key: string, value: unknown) {
    if (this.failWrites) throw new Error("quota exceeded");
    this.values.set(key, structuredClone(value));
  }

  async remove(key: string) {
    this.values.delete(key);
  }
}

function fixture() {
  const { WechatDurableStore } = require("../../miniprogram/lib/store.js");
  const { createWechatChecklistService } = require("../../miniprogram/lib/app-service.js");
  const storage = new MemoryStorage();
  const store = new WechatDurableStore({
    storage,
    validate: (candidate: AppSnapshot) => validateBusinessInvariants(candidate),
    createInitial: () => appSnapshot(),
  });
  let sequence = 0;
  const service = createWechatChecklistService({
    store,
    templates: content.templates,
    now: () => `2026-09-01T08:${String(sequence).padStart(2, "0")}:00.000+08:00`,
    newId: (kind: string) => `${kind}.native-${++sequence}`,
  });
  return { service, storage, store, createWechatChecklistService };
}

describe("native WeChat trusted vertical slice", () => {
  it("durably completes a direct run flow and resumes it after interruption", async () => {
    const { service, store, createWechatChecklistService } = fixture();
    await service.initialize();
    const started = await service.startTemplate("official.daily_out");
    await service.toggleConfirmed(started.checkRunId, "daily.phone");
    await service.markNotNeeded(started.checkRunId, "daily.umbrella");
    await service.addTemporaryItem(started.checkRunId, "门窗复核", true);

    const resumedService = createWechatChecklistService({
      store,
      templates: content.templates,
      now: () => "2026-09-01T08:10:00.000+08:00",
      newId: (kind: string) => `${kind}.resumed`,
    });
    const resumed = await resumedService.initialize();
    expect(resumed.checkRuns.find((run: { checkRunId: string }) => run.checkRunId === started.checkRunId))
      .toMatchObject({ status: "inProgress" });

    const firstClose = await resumedService.closeRun(started.checkRunId, false);
    expect(firstClose).toMatchObject({ kind: "needsKeyConfirmation" });
    const finalClose = await resumedService.closeRun(started.checkRunId, true);
    expect(finalClose).toMatchObject({ kind: "endedWithUnresolved" });
    expect((await store.load()).checkRuns[0]).toMatchObject({ status: "endedWithUnresolved" });
  });

  it("does not advance service state when durable persistence fails", async () => {
    const { service, storage } = fixture();
    await service.initialize();
    const started = await service.startTemplate("official.daily_out");
    const before = service.getSnapshot();
    storage.failWrites = true;

    await expect(service.toggleConfirmed(started.checkRunId, "daily.phone")).rejects.toThrow(
      "本地保存失败",
    );

    expect(service.getSnapshot()).toEqual(before);
    expect(service.getRun(started.checkRunId).items.find((item: { sourceItemId?: string }) => item.sourceItemId === "daily.phone"))
      .toMatchObject({ state: "unchecked" });
  });

  it("rejects an oversized private note without truncating or advancing the durable truth", async () => {
    const { service, store } = fixture();
    await service.initialize();
    const started = await service.startTemplate("official.daily_out");
    const before = service.getSnapshot();

    await expect(
      service.setOneTimeNote(started.checkRunId, "daily.phone", "私".repeat(501)),
    ).rejects.toThrow("500");

    expect(service.getSnapshot()).toEqual(before);
    expect(await store.load()).toEqual(before);
  });

  it("keeps private notes out of the native share summary", async () => {
    const { service } = fixture();
    await service.initialize();
    const started = await service.startTemplate("official.daily_out");
    await service.setOneTimeNote(started.checkRunId, "daily.phone", "不要分享这段私密事实");
    await service.toggleConfirmed(started.checkRunId, "daily.phone");

    const text = service.shareRunText(started.checkRunId);
    expect(text).toContain("✓ 手机");
    expect(text).toContain("本次备注默认不包含");
    expect(text).not.toContain("不要分享这段私密事实");
  });

  it("creates and consumes a frozen plan without silently replacing its template", async () => {
    const { service } = fixture();
    await service.initialize();
    const plan = await service.createPlan("official.hotel_checkout", {
      scheduledDate: "2026-09-05",
      scheduledTime: "09:30",
      createdTimeZoneId: "Asia/Shanghai",
    });
    const originalTitle = plan.plannedTemplateSnapshot.title;
    content.templates.find((template: { templateId: string }) => template.templateId === "official.hotel_checkout").title = "不应替换计划";

    const result = await service.startPlan(plan.plannedCheckId);

    expect(result.run.runTemplateSnapshot.title).toBe(originalTitle);
    expect(result.plan).toMatchObject({ status: "consumed", startedCheckRunId: result.run.checkRunId });
  });
});
