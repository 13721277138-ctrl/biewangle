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

function runCard(run) {
  const unchecked = run.items.filter((item) => item.state === "unchecked");
  return {
    checkRunId: run.checkRunId,
    title: run.runTemplateSnapshot.title,
    uncheckedCount: unchecked.length,
    uncheckedKeyCount: unchecked.filter((item) => item.importance === "key").length,
  };
}

function templateCard(template, kind) {
  const sourceId = template.templateId || template.personalTemplateId;
  return {
    applicability: template.applicability || "当前设备上的个人检查模板。",
    itemCount: template.groups.reduce((count, group) => count + group.items.length, 0),
    kind,
    sourceId,
    title: template.title,
  };
}

Page({
  data: {
    busy: false,
    continueRun: null,
    error: "",
    featuredTemplates: [],
    loading: true,
    moreRunCount: 0,
    pendingPlans: [],
    quickTemplates: [],
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const snapshot = app.service.getSnapshot();
      const library = app.service.getTemplateLibrary();
      const rankedRuns = domain.rankContinueRuns(
        snapshot.checkRuns,
        snapshot.plannedChecks,
        localNow(new Date()),
      );
      const pendingPlans = domain
        .rankUpcomingPlans(snapshot.plannedChecks)
        .slice(0, 3)
        .map((plan) => ({
          plannedCheckId: plan.plannedCheckId,
          title: plan.plannedTemplateSnapshot.title,
          when: `${plan.scheduledDate}${plan.scheduledTime ? ` ${plan.scheduledTime}` : " 全天"}`,
        }));
      const visibleOfficial = library.official.filter((entry) => !entry.hidden);
      const quickTemplates = visibleOfficial
        .filter((entry) => entry.favorite)
        .map((entry) => templateCard(entry.template, "收藏"))
        .concat(library.personal.map((template) => templateCard(template, "个人")))
        .slice(0, 6);
      const featuredTemplates = visibleOfficial
        .filter((entry) => entry.template.featuredOrder !== null)
        .sort((left, right) => left.template.featuredOrder - right.template.featuredOrder)
        .map((entry) => templateCard(entry.template, `精选 ${entry.template.featuredOrder}`));

      this.setData({
        busy: false,
        continueRun: rankedRuns[0] ? runCard(rankedRuns[0]) : null,
        error: "",
        featuredTemplates,
        loading: false,
        moreRunCount: Math.max(rankedRuns.length - 1, 0),
        pendingPlans,
        quickTemplates,
      });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "无法读取本地数据。", loading: false });
    }
  },

  async startTemplate(event) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      const run = await app.service.startTemplate(event.currentTarget.dataset.templateId);
      wx.navigateTo({ url: `/pages/run/run?id=${encodeURIComponent(run.checkRunId)}` });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，未开始检查。" });
    }
  },

  async startPlan(event) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      const result = await app.service.startPlan(event.currentTarget.dataset.planId);
      wx.navigateTo({ url: `/pages/run/run?id=${encodeURIComponent(result.run.checkRunId)}` });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，计划未开始。" });
    }
  },

  openRun() {
    wx.navigateTo({ url: `/pages/run/run?id=${encodeURIComponent(this.data.continueRun.checkRunId)}` });
  },

  openMoreRuns() {
    wx.navigateTo({ url: "/pages/more-runs/more-runs" });
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

  openTemplates() {
    wx.navigateTo({ url: "/pages/templates/templates" });
  },

  openSearch() {
    wx.navigateTo({ url: "/pages/search/search" });
  },

  createTemplate() {
    wx.navigateTo({ url: "/pages/template-edit/template-edit" });
  },

  openTemplate(event) {
    wx.navigateTo({
      url: `/pages/template-detail/template-detail?id=${encodeURIComponent(event.currentTarget.dataset.templateId)}`,
    });
  },

  onShareAppMessage() {
    return {
      title: "别忘了｜无账号、离线可用的安心检查清单",
      path: "/pages/home/home",
    };
  },
});
