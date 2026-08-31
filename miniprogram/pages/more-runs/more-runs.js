const app = getApp();
const domain = require("../../lib/domain.js");

function pad(value) {
  return String(value).padStart(2, "0");
}

function localNow(date) {
  return {
    localDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    localTime: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

Page({
  data: {
    error: "",
    loading: true,
    runs: [],
  },

  async onShow() {
    try {
      await app.ready;
      const snapshot = app.service.getSnapshot();
      const now = new Date();
      const runs = domain
        .rankContinueRuns(snapshot.checkRuns, snapshot.plannedChecks, localNow(now))
        .map((run, index) => {
          const unchecked = run.items.filter((item) => item.state === "unchecked");
          return {
            checkRunId: run.checkRunId,
            isPrioritized: index === 0,
            isStale: domain.isStaleCandidate(run, now.toISOString()),
            lastInteractedAt: run.lastInteractedAt,
            title: run.runTemplateSnapshot.title,
            totalCount: run.items.length,
            uncheckedCount: unchecked.length,
            uncheckedKeyCount: unchecked.filter((item) => item.importance === "key").length,
          };
        });
      this.setData({ error: "", loading: false, runs });
    } catch (error) {
      this.setData({ error: error.message || "无法读取进行中的检查。", loading: false });
    }
  },

  openRun(event) {
    wx.navigateTo({
      url: `/pages/run/run?id=${encodeURIComponent(event.currentTarget.dataset.runId)}`,
    });
  },

  openTemplates() {
    wx.navigateTo({ url: "/pages/templates/templates" });
  },
});
