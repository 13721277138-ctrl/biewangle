import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  exportBackup,
  serializeBackup,
  startRun,
  validateBusinessInvariants,
  type AppSnapshot,
  type CheckRun,
  type OfficialTemplate,
  type PersonalTemplate,
} from "../../packages/domain/src/index";
import { appSnapshot } from "../../packages/domain/test/app-fixtures";

const require = createRequire(import.meta.url);
const content = require("../../miniprogram/generated/official-templates.js") as {
  templates: OfficialTemplate[];
};

class AuditStorage {
  readonly values = new Map<string, unknown>();
  private failSnapshotWrite = false;

  failNextSnapshotCommit() {
    this.failSnapshotWrite = true;
  }

  async get(key: string) {
    return structuredClone(this.values.get(key));
  }

  async set(key: string, value: unknown) {
    if (this.failSnapshotWrite && /biewangle\.snapshot\.[ab]$/u.test(key)) {
      this.failSnapshotWrite = false;
      throw new Error("injected snapshot write failure");
    }
    this.values.set(key, structuredClone(value));
  }

  async remove(key: string) {
    this.values.delete(key);
  }

  protectiveKeys() {
    return [...this.values.keys()].filter((key) =>
      key.startsWith("biewangle.snapshot.protective."),
    );
  }
}

interface TemplateLibrary {
  official: Array<{ template: OfficialTemplate; favorite: boolean; hidden: boolean }>;
  personal: PersonalTemplate[];
  deletedPersonal: PersonalTemplate[];
}

interface NativeService {
  initialize(): Promise<AppSnapshot>;
  getSnapshot(): AppSnapshot;
  getRun(checkRunId: string): CheckRun;
  getTemplateLibrary(): TemplateLibrary;
  getTemplate(templateId: string): OfficialTemplate | PersonalTemplate;
  createBackup(): Promise<{
    envelope: ReturnType<typeof exportBackup>;
    text: string;
  }>;
  startTemplate(templateId: string): Promise<CheckRun>;
  closeRun(checkRunId: string, keyRiskConfirmed: boolean, intent?: string): Promise<{ kind: string }>;
  savePersonalTemplate(input: {
    personalTemplateId?: string;
    sourceTemplateId?: string;
    title: string;
    itemTitles: string[];
    icon?: string;
    themeColor?: string;
  }): Promise<PersonalTemplate>;
  softDeletePersonalTemplate(personalTemplateId: string): Promise<PersonalTemplate>;
  restorePersonalTemplate(personalTemplateId: string): Promise<PersonalTemplate>;
  toggleFavorite(templateId: string): Promise<AppSnapshot>;
  toggleHidden(templateId: string): Promise<AppSnapshot>;
  searchTemplates(query: string): {
    official: Array<{ template: OfficialTemplate; score: number; matches: string[] }>;
    personal: PersonalTemplate[];
  };
  reorderRunItems(checkRunId: string, orderedRunItemIds: string[]): Promise<CheckRun>;
  restartFromHistory(checkRunId: string): Promise<CheckRun>;
  previewBackup(raw: string): {
    exportedAt: string;
    personalTemplates: number;
    plans: number;
    runs: number;
  };
  readableExport(): string;
  restoreBackup(raw: string): Promise<AppSnapshot>;
  resetAll(expectedUpdatedAt: string): Promise<AppSnapshot>;
}

function fixture() {
  const { WechatDurableStore } = require("../../miniprogram/lib/store.js") as {
    WechatDurableStore: new (options: {
      storage: AuditStorage;
      validate: (candidate: AppSnapshot) => AppSnapshot;
      createInitial: () => AppSnapshot;
    }) => unknown;
  };
  const { createWechatChecklistService } = require("../../miniprogram/lib/app-service.js") as {
    createWechatChecklistService: (options: Record<string, unknown>) => NativeService;
  };
  const storage = new AuditStorage();
  const store = new WechatDurableStore({
    storage,
    validate: validateBusinessInvariants,
    createInitial: () => appSnapshot(),
  });
  let sequence = 0;
  const service = createWechatChecklistService({
    store,
    templates: content.templates,
    now: () => `2026-09-01T09:${String(sequence).padStart(2, "0")}:00.000+08:00`,
    newId: (kind: string) => `${kind}.full-v1-${++sequence}`,
  });
  return { service, storage };
}

describe("native WeChat full V1", () => {
  it("starts a durable run from every one of the 13 official templates", async () => {
    const { service } = fixture();
    await service.initialize();

    const library = service.getTemplateLibrary();
    expect(library.official.map((entry) => entry.template.templateId)).toEqual([
      "official.daily_out",
      "official.important_errand",
      "official.business_trip",
      "official.domestic_travel",
      "official.international_travel",
      "official.hotel_checkout",
      "official.self_drive",
      "official.child_day_out",
      "official.child_travel",
      "official.away_from_home",
      "official.move_out_final",
      "official.hospital_admission",
      "official.important_medical_visit",
    ]);

    for (const entry of library.official) {
      const run = await service.startTemplate(entry.template.templateId);
      expect(run.sourceTemplateIdentity).toEqual({
        kind: "official",
        templateId: entry.template.templateId,
        contentVersion: 1,
      });
    }
    expect(service.getSnapshot().checkRuns).toHaveLength(13);
  });

  it("creates a personal derivative while keeping the official source byte-stable", async () => {
    const { service } = fixture();
    await service.initialize();
    const officialBefore = service.getTemplate("official.daily_out");

    const personal = await service.savePersonalTemplate({
      sourceTemplateId: "official.daily_out",
      title: "我的出门复核",
      itemTitles: ["手机", "门窗", "水杯"],
      icon: "home",
      themeColor: "ocean",
    });

    expect(personal).toMatchObject({
      derivedFromTemplateId: "official.daily_out",
      derivedFromContentVersion: 1,
      title: "我的出门复核",
      icon: "home",
      themeColor: "ocean",
    });
    expect(personal.groups.flatMap((group) => group.items).map((item) => item.title)).toEqual([
      "手机",
      "门窗",
      "水杯",
    ]);
    expect(service.getTemplate("official.daily_out")).toEqual(officialBefore);

    const run = await service.startTemplate(personal.personalTemplateId);
    expect(run.sourceTemplateIdentity).toMatchObject({
      kind: "personal",
      personalTemplateId: personal.personalTemplateId,
    });
    expect(run.runTemplateSnapshot.title).toBe("我的出门复核");
  });

  it("edits, copies, soft-deletes and restores only personal templates", async () => {
    const { service } = fixture();
    await service.initialize();
    const created = await service.savePersonalTemplate({
      title: "晨间清单",
      itemTitles: ["钥匙", "工牌"],
    });
    const edited = await service.savePersonalTemplate({
      personalTemplateId: created.personalTemplateId,
      title: "晨间出门清单",
      itemTitles: ["钥匙", "工牌", "耳机"],
    });
    expect(edited.personalTemplateId).toBe(created.personalTemplateId);
    expect(edited.createdAt).toBe(created.createdAt);
    expect(edited.groups[0]?.items.map((item) => item.title)).toEqual(["钥匙", "工牌", "耳机"]);

    const copied = await service.savePersonalTemplate({
      sourceTemplateId: created.personalTemplateId,
      title: "晨间清单副本",
      itemTitles: ["钥匙", "工牌"],
    });
    expect(copied.personalTemplateId).not.toBe(created.personalTemplateId);
    expect(copied.title).toBe("晨间清单副本");

    await service.softDeletePersonalTemplate(created.personalTemplateId);
    expect(service.getTemplateLibrary().personal.map((template) => template.personalTemplateId))
      .not.toContain(created.personalTemplateId);
    expect(service.getTemplateLibrary().deletedPersonal.map((template) => template.personalTemplateId))
      .toContain(created.personalTemplateId);

    await service.restorePersonalTemplate(created.personalTemplateId);
    expect(service.getTemplateLibrary().personal.map((template) => template.personalTemplateId))
      .toContain(created.personalTemplateId);
  });

  it("rejects an empty personal template without changing durable state", async () => {
    const { service } = fixture();
    await service.initialize();
    const before = service.getSnapshot();

    await expect(service.savePersonalTemplate({ title: "   ", itemTitles: [] })).rejects.toThrow();

    expect(service.getSnapshot()).toEqual(before);
  });

  it("persists favorite and hidden settings without mutating the official template", async () => {
    const { service } = fixture();
    await service.initialize();
    const officialBefore = service.getTemplate("official.hotel_checkout");

    await service.toggleFavorite("official.hotel_checkout");
    await service.toggleHidden("official.hotel_checkout");

    const entry = service.getTemplateLibrary().official.find(
      (candidate) => candidate.template.templateId === "official.hotel_checkout",
    );
    expect(entry).toMatchObject({ favorite: true, hidden: true });
    expect(service.getTemplate("official.hotel_checkout")).toEqual(officialBefore);
  });

  it("returns the three frozen local-search cases with literal weighted order", async () => {
    const { service } = fixture();
    await service.initialize();

    expect(service.searchTemplates("护照").official.map((result) => [
      result.template.templateId,
      result.score,
      result.matches,
    ])).toEqual([
      ["official.international_travel", 400, ["aliases", "itemTitle"]],
    ]);
    expect(service.searchTemplates("医保卡").official.map((result) => result.template.templateId)).toEqual([
      "official.important_medical_visit",
      "official.hospital_admission",
    ]);
    expect(service.searchTemplates("保险箱").official.map((result) => result.template.templateId)).toEqual([
      "official.hotel_checkout",
    ]);
  });

  it("finds active personal content locally and excludes soft-deleted personal content", async () => {
    const { service } = fixture();
    await service.initialize();
    const personal = await service.savePersonalTemplate({
      title: "周末泳池",
      itemTitles: ["泳镜", "毛巾"],
    });

    expect(service.searchTemplates("泳镜").personal.map((template) => template.personalTemplateId)).toEqual([
      personal.personalTemplateId,
    ]);
    await service.softDeletePersonalTemplate(personal.personalTemplateId);
    expect(service.searchTemplates("泳镜").personal).toEqual([]);
  });

  it("persists explicit run ordering and restarts history as a distinct unchecked run", async () => {
    const { service } = fixture();
    await service.initialize();
    const run = await service.startTemplate("official.daily_out");
    const reversed = run.items.map((item) => item.runItemId).reverse();

    const reordered = await service.reorderRunItems(run.checkRunId, reversed);
    expect(reordered.items.map((item) => item.runItemId)).toEqual(reversed);
    expect(reordered.items.map((item) => item.runSortOrder)).toEqual(
      reversed.map((_, index) => index),
    );

    await service.closeRun(run.checkRunId, false, "discard");
    const restarted = await service.restartFromHistory(run.checkRunId);
    expect(restarted.checkRunId).not.toBe(run.checkRunId);
    expect(restarted.runTemplateSnapshot).toEqual(run.runTemplateSnapshot);
    expect(restarted.items.every((item) => item.state === "unchecked")).toBe(true);
    expect(service.getRun(run.checkRunId).status).toBe("discarded");
  });

  it("previews and atomically restores a valid cross-platform Backup Envelope", async () => {
    const { service, storage } = fixture();
    await service.initialize();
    await service.startTemplate("official.daily_out");
    const incomingRun = startRun(content.templates[12]!, "2026-09-02T08:00:00.000+08:00", {
      checkRunId: "run.incoming-wechat-restore",
    });
    const incoming = appSnapshot({
      checkRuns: [incomingRun],
      updatedAt: "2026-09-02T08:00:00.000+08:00",
    });
    const raw = serializeBackup(exportBackup(incoming, "pwa", "2026-09-02T08:05:00.000+08:00"));

    expect(service.previewBackup(raw)).toEqual({
      exportedAt: "2026-09-02T08:05:00.000+08:00",
      personalTemplates: 0,
      plans: 0,
      runs: 1,
    });
    const restored = await service.restoreBackup(raw);

    expect(restored).toEqual(incoming);
    expect(service.getSnapshot()).toEqual(incoming);
    expect(storage.protectiveKeys()).toHaveLength(1);
  });

  it("durably records backup generation before returning complete and readable exports", async () => {
    const { service, storage } = fixture();
    await service.initialize();
    await service.startTemplate("official.daily_out");

    const backup = await service.createBackup();
    const committed = service.getSnapshot();
    expect(committed.lastBackupAt).toBe(backup.envelope.exportedAt);
    expect(committed.updatedAt).toBe(backup.envelope.exportedAt);
    expect(backup.envelope.sourcePlatform).toBe("wechat");
    expect(backup.envelope.data).toEqual(committed);
    expect(service.readableExport()).toContain("# 别忘了 · 人类可读导出");

    const beforeFailure = service.getSnapshot();
    storage.failNextSnapshotCommit();
    await expect(service.createBackup()).rejects.toThrow("本地保存失败");
    expect(service.getSnapshot()).toEqual(beforeFailure);
  });

  it("protects current data before rejecting invalid or future backup input", async () => {
    const { service, storage } = fixture();
    await service.initialize();
    await service.startTemplate("official.daily_out");
    const before = service.getSnapshot();

    await expect(service.restoreBackup("{not json")).rejects.toThrow("有效 JSON");
    expect(service.getSnapshot()).toEqual(before);
    expect(storage.protectiveKeys()).toHaveLength(1);

    await service.startTemplate("official.hotel_checkout");
    const beforeFuture = service.getSnapshot();
    const future = exportBackup(beforeFuture, "wechat", "2026-09-02T08:05:00.000+08:00") as unknown as Record<string, unknown>;
    future.backupFormatVersion = 2;
    await expect(service.restoreBackup(JSON.stringify(future))).rejects.toThrow("备份格式版本");
    expect(service.getSnapshot()).toEqual(beforeFuture);
    expect(storage.protectiveKeys()).toHaveLength(2);
  });

  it("keeps service and durable truth unchanged when restore commit fails after protection", async () => {
    const { service, storage } = fixture();
    await service.initialize();
    await service.startTemplate("official.daily_out");
    const before = service.getSnapshot();
    const incoming = appSnapshot({ updatedAt: "2026-09-02T08:00:00.000+08:00" });
    const raw = serializeBackup(exportBackup(incoming, "pwa", "2026-09-02T08:05:00.000+08:00"));
    storage.failNextSnapshotCommit();

    await expect(service.restoreBackup(raw)).rejects.toThrow("本地保存失败");

    expect(service.getSnapshot()).toEqual(before);
    expect(storage.protectiveKeys()).toHaveLength(1);
  });

  it("requires the confirmed snapshot version and creates protection before full reset", async () => {
    const { service, storage } = fixture();
    await service.initialize();
    await service.startTemplate("official.daily_out");
    const confirmedUpdatedAt = service.getSnapshot().updatedAt;
    await service.toggleFavorite("official.daily_out");

    await expect(service.resetAll(confirmedUpdatedAt)).rejects.toThrow("发生了变化");
    expect(service.getSnapshot().checkRuns).toHaveLength(1);
    expect(storage.protectiveKeys()).toHaveLength(0);

    const reset = await service.resetAll(service.getSnapshot().updatedAt);
    expect(reset).toMatchObject({
      personalTemplates: [],
      plannedChecks: [],
      checkRuns: [],
      settings: {
        favoriteTemplateIds: [],
        hiddenOfficialTemplateIds: [],
        backupNudgeDismissed: false,
      },
    });
    expect(storage.protectiveKeys()).toHaveLength(1);
  });

  it("shows the persisted recent-backup fact on the native data page", () => {
    const pageLogic = readFileSync(resolve("miniprogram/pages/data/data.js"), "utf8");
    const markup = readFileSync(resolve("miniprogram/pages/data/data.wxml"), "utf8");

    expect(pageLogic).toContain("lastBackupAt: snapshot.lastBackupAt");
    expect(markup).toContain("{{facts.lastBackupAt");
  });

  it("registers every native full-V1 route with a complete page artifact", () => {
    const appConfig = JSON.parse(readFileSync(resolve("miniprogram/app.json"), "utf8")) as {
      pages: string[];
    };
    const requiredRoutes = [
      "pages/home/home",
      "pages/run/run",
      "pages/plans/plans",
      "pages/history/history",
      "pages/data/data",
      "pages/templates/templates",
      "pages/template-detail/template-detail",
      "pages/template-edit/template-edit",
      "pages/search/search",
      "pages/more-runs/more-runs",
      "pages/history-detail/history-detail",
    ];

    expect(appConfig.pages).toEqual(requiredRoutes);
    for (const route of requiredRoutes) {
      for (const extension of ["js", "json", "wxml", "wxss"]) {
        expect(existsSync(resolve(`miniprogram/${route}.${extension}`)), `${route}.${extension}`).toBe(true);
      }
    }
  });
});
