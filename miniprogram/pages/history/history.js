const app = getApp();

function statusLabel(status) {
  if (status === "completed") return "已完成";
  if (status === "endedWithUnresolved") return "有未确认项结束";
  if (status === "discarded") return "已放弃";
  return "进行中";
}

function unavailableReason(reason) {
  if (reason === "windowExpired") return "结束超过 2 小时，不能再重开；历史事实保持不变。";
  if (reason === "statusNotReopenable") return "当前状态不能重开。";
  return "缺少可验证的结束事实，不能重开。";
}

Page({
  data: {
    busy: false,
    error: "",
    loading: true,
    runs: [],
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const snapshot = app.service.getSnapshot();
      const runs = snapshot.checkRuns
        .filter((run) => run.status !== "inProgress")
        .slice()
        .sort((left, right) => right.lastInteractedAt.localeCompare(left.lastInteractedAt))
        .map((run) => {
          const unresolved = run.items.filter((item) => item.state === "unchecked");
          const close = run.closedEvents[run.closedEvents.length - 1];
          return {
            checkRunId: run.checkRunId,
            closedAt: close ? close.closedAt : run.lastInteractedAt,
            isReopenableStatus: run.status === "completed" || run.status === "endedWithUnresolved",
            statusLabel: statusLabel(run.status),
            title: run.runTemplateSnapshot.title,
            totalCount: run.items.length,
            unresolvedCount: unresolved.length,
            unresolvedKeyCount: unresolved.filter((item) => item.importance === "key").length,
          };
        });
      this.setData({ error: "", loading: false, runs });
    } catch (error) {
      this.setData({ error: error.message || "无法读取检查历史。", loading: false });
    }
  },

  openRun(event) {
    wx.navigateTo({ url: `/pages/run/run?id=${encodeURIComponent(event.currentTarget.dataset.runId)}` });
  },

  async reopenRun(event) {
    if (this.data.busy) return;
    const checkRunId = event.currentTarget.dataset.runId;
    this.setData({ busy: true, error: "" });
    try {
      const result = await app.service.reopenRun(checkRunId);
      if (result.kind !== "reopened") {
        this.setData({ busy: false, error: unavailableReason(result.reason) });
        return;
      }
      wx.redirectTo({ url: `/pages/run/run?id=${encodeURIComponent(checkRunId)}` });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，历史事实未改变。" });
    }
  },

  async copySummary(event) {
    try {
      const text = app.service.shareRunText(event.currentTarget.dataset.runId);
      const result = await app.platform.copyText(text);
      wx.showToast({ title: result.kind === "success" ? "摘要已复制" : result.message, icon: "none" });
    } catch (error) {
      this.setData({ error: error.errMsg || error.message || "复制失败，请重试。" });
    }
  },
});
