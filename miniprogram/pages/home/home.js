const app = getApp();

function statusLabel(status) {
  return status === "inProgress" ? "进行中" : status;
}

Page({
  data: {
    activeRuns: [],
    error: "",
    loading: true,
    pendingPlans: [],
    templates: [],
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const snapshot = app.service.getSnapshot();
      this.setData({
        activeRuns: snapshot.checkRuns
          .filter((run) => run.status === "inProgress")
          .map((run) => ({
            checkRunId: run.checkRunId,
            title: run.runTemplateSnapshot.title,
            statusLabel: statusLabel(run.status),
            uncheckedCount: run.items.filter((item) => item.state === "unchecked").length,
          })),
        pendingPlans: snapshot.plannedChecks
          .filter((plan) => plan.status === "pending")
          .map((plan) => ({
            plannedCheckId: plan.plannedCheckId,
            title: plan.plannedTemplateSnapshot.title,
            when: `${plan.scheduledDate}${plan.scheduledTime ? ` ${plan.scheduledTime}` : ""}`,
          })),
        templates: app.service.getVerticalTemplates().map((template) => ({
          applicability: template.applicability,
          itemCount: template.groups.reduce((count, group) => count + group.items.length, 0),
          templateId: template.templateId,
          title: template.title,
        })),
        error: "",
        loading: false,
      });
    } catch (error) {
      this.setData({ error: error.message || "无法读取本地数据。", loading: false });
    }
  },

  async startTemplate(event) {
    const templateId = event.currentTarget.dataset.templateId;
    try {
      this.setData({ loading: true, error: "" });
      const run = await app.service.startTemplate(templateId);
      wx.navigateTo({ url: `/pages/run/run?id=${encodeURIComponent(run.checkRunId)}` });
    } catch (error) {
      this.setData({ error: error.message || "本地保存失败，请重试。", loading: false });
    }
  },

  openRun(event) {
    wx.navigateTo({ url: `/pages/run/run?id=${encodeURIComponent(event.currentTarget.dataset.runId)}` });
  },

  openPlans() {
    wx.navigateTo({ url: "/pages/plans/plans" });
  },

  openHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
  },

  openData() {
    wx.navigateTo({ url: "/pages/data/data" });
  },

  onShareAppMessage() {
    return {
      title: "别忘了｜无账号、离线可用的安心检查清单",
      path: "/pages/home/home",
    };
  },
});
