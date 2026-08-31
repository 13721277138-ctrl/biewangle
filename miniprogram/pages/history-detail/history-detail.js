const app = getApp();
const { projectRunView } = require("../../lib/run-view.js");

function statusLabel(status) {
  if (status === "completed") return "已完成";
  if (status === "endedWithUnresolved") return "有未确认项结束";
  if (status === "discarded") return "已放弃";
  return "进行中";
}

function unavailableReason(reason) {
  if (reason === "windowExpired") return "结束超过 2 小时，不能重开原 Run；可以从冻结快照重新开始一个新 Run。";
  if (reason === "statusNotReopenable") return "当前事实状态不能重开原 Run。";
  return "缺少可验证的结束事件，不能重开原 Run。";
}

Page({
  data: {
    busy: false,
    error: "",
    loading: true,
    run: null,
  },

  onLoad(options) {
    this.checkRunId = decodeURIComponent(options.id || "");
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const run = app.service.getRun(this.checkRunId);
      const close = run.closedEvents[run.closedEvents.length - 1];
      const projection = projectRunView(run, "all");
      this.setData({
        error: "",
        loading: false,
        run: {
          ...run,
          canReopen: run.status === "completed" || run.status === "endedWithUnresolved",
          closedAt: close ? close.closedAt : run.lastInteractedAt,
          groups: projection.groups,
          items: projection.visibleItems,
          statusLabel: statusLabel(run.status),
          totalCount: projection.allItems.length,
          uncheckedCount: projection.unresolvedCount,
          uncheckedKeyCount: projection.unresolvedKeyCount,
        },
      });
    } catch (error) {
      this.setData({ error: error.message || "无法读取历史事实。", loading: false });
    }
  },

  async reopenRun() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      const result = await app.service.reopenRun(this.checkRunId);
      if (result.kind !== "reopened") {
        this.setData({ busy: false, error: unavailableReason(result.reason) });
        return;
      }
      wx.redirectTo({ url: `/pages/run/run?id=${encodeURIComponent(this.checkRunId)}` });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，历史事实未改变。" });
    }
  },

  async restartRun() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      const run = await app.service.restartFromHistory(this.checkRunId);
      wx.redirectTo({ url: `/pages/run/run?id=${encodeURIComponent(run.checkRunId)}` });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，未创建新的检查。" });
    }
  },

  async copySummary() {
    try {
      const result = await app.platform.copyText(app.service.shareRunText(this.checkRunId));
      wx.showToast({ title: result.kind === "success" ? "摘要已复制" : result.message, icon: "none" });
    } catch (error) {
      this.setData({ error: error.errMsg || error.message || "复制失败，请重试。" });
    }
  },

  onShareAppMessage() {
    const run = this.data.run;
    return {
      title: run ? `别忘了｜${run.runTemplateSnapshot.title}（${run.statusLabel}）` : "别忘了",
      path: "/pages/home/home",
    };
  },
});
