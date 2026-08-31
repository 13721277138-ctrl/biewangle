import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

function nativePlatform(): {
  createWechatPlatform: (wxApi: Record<string, unknown>) => {
    capabilities(): Record<string, boolean | string>;
    copyText(text: string): Promise<{ kind: string; message?: string }>;
    chooseBackupText(maxBytes: number): Promise<{
      kind: string;
      message?: string;
      name?: string;
      size?: number;
      text?: string;
    }>;
    calendarEventForPlan(plan: Record<string, unknown>): Record<string, unknown>;
    addCalendarEvent(event: Record<string, unknown>): Promise<{ kind: string; message?: string }>;
    shareFile(input: Record<string, unknown>): Promise<{ kind: string; message?: string }>;
    activateUpdate(): { kind: string; message?: string };
  };
} {
  return require("../../miniprogram/lib/platform.js");
}

describe("native WeChat platform adapter", () => {
  it("feature-detects capabilities and reports unavailable features honestly", async () => {
    const { createWechatPlatform } = nativePlatform();
    const platform = createWechatPlatform({});

    expect(platform.capabilities()).toEqual({
      clipboard: false,
      calendar: false,
      chatFileImport: false,
      fileShare: false,
      updateManager: false,
      subscriptionMessages: "unavailable",
    });
    await expect(platform.copyText("备份文本")).resolves.toMatchObject({
      kind: "unavailable",
    });
    await expect(platform.chooseBackupText(10 * 1024 * 1024)).resolves.toMatchObject({
      kind: "unavailable",
    });
    await expect(platform.addCalendarEvent({ title: "出门检查" })).resolves.toMatchObject({
      kind: "unavailable",
    });
    expect(platform.calendarEventForPlan({
      scheduledDate: "2026-09-05",
      plannedTemplateSnapshot: { title: "全天计划" },
    })).toMatchObject({
      allDay: true,
      startTime: Math.floor(new Date(2026, 8, 5, 0, 0).getTime() / 1000),
    });
    expect(() => platform.calendarEventForPlan({
      scheduledDate: "2026-02-30",
      plannedTemplateSnapshot: { title: "不存在的日期" },
    })).toThrow("日期不存在");
    expect(platform.activateUpdate()).toMatchObject({ kind: "unavailable" });
  });

  it("selects one WeChat chat JSON file and reads it as bounded UTF-8 text", async () => {
    const { createWechatPlatform } = nativePlatform();
    const wxApi = {
      chooseMessageFile: vi.fn(({ success }: { success: (result: unknown) => void }) =>
        success({
          tempFiles: [{
            name: "biewangle.json",
            path: "/tmp/biewangle.json",
            size: 128,
            time: 1_788_000_000,
            type: "file",
          }],
        }),
      ),
      getFileSystemManager: vi.fn(() => ({
        readFile: ({ success }: { success: (result: unknown) => void }) =>
          success({ data: "{\"productId\":\"biewangle\"}" }),
      })),
    };
    const platform = createWechatPlatform(wxApi);

    expect(platform.capabilities()).toMatchObject({ chatFileImport: true });
    await expect(platform.chooseBackupText(10 * 1024 * 1024)).resolves.toEqual({
      kind: "success",
      name: "biewangle.json",
      size: 128,
      text: "{\"productId\":\"biewangle\"}",
    });
  });

  it("rejects an oversized chat backup before reading its contents", async () => {
    const { createWechatPlatform } = nativePlatform();
    const readFile = vi.fn();
    const wxApi = {
      chooseMessageFile: vi.fn(({ success }: { success: (result: unknown) => void }) =>
        success({
          tempFiles: [{
            name: "too-large.json",
            path: "/tmp/too-large.json",
            size: 10 * 1024 * 1024 + 1,
            time: 1_788_000_000,
            type: "file",
          }],
        }),
      ),
      getFileSystemManager: vi.fn(() => ({ readFile })),
    };
    const platform = createWechatPlatform(wxApi);

    await expect(platform.chooseBackupText(10 * 1024 * 1024)).rejects.toThrow("10 MB");
    expect(readFile).not.toHaveBeenCalled();
  });

  it("calls native clipboard, calendar, file-share and update APIs when present", async () => {
    const { createWechatPlatform } = nativePlatform();
    const applyUpdate = vi.fn();
    const wxApi = {
      setClipboardData: vi.fn(({ success }: { success: () => void }) => success()),
      addPhoneCalendar: vi.fn(({ success }: { success: () => void }) => success()),
      shareFileMessage: vi.fn(({ success }: { success: () => void }) => success()),
      getUpdateManager: vi.fn(() => ({ applyUpdate })),
    };
    const platform = createWechatPlatform(wxApi);

    expect(platform.capabilities()).toMatchObject({
      clipboard: true,
      calendar: true,
      fileShare: true,
      updateManager: true,
      subscriptionMessages: "unavailable",
    });
    await expect(platform.copyText("备份文本")).resolves.toEqual({ kind: "success" });
    const calendarEvent = platform.calendarEventForPlan({
      scheduledDate: "2026-09-05",
      scheduledTime: "09:30",
      plannedTemplateSnapshot: { title: "出门检查" },
    });
    expect(calendarEvent).toMatchObject({
      title: "别忘了：出门检查",
      startTime: Math.floor(new Date(2026, 8, 5, 9, 30).getTime() / 1000),
      allDay: false,
    });
    await expect(platform.addCalendarEvent(calendarEvent)).resolves.toEqual({ kind: "success" });
    expect(wxApi.addPhoneCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: expect.any(Number), allDay: false }),
    );
    await expect(platform.shareFile({ filePath: "/tmp/backup.json" })).resolves.toEqual({ kind: "success" });
    expect(platform.activateUpdate()).toEqual({ kind: "success" });
    expect(applyUpdate).toHaveBeenCalledOnce();
  });
});
