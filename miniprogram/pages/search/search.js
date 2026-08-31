const app = getApp();

const MATCH_LABELS = Object.freeze({
  title: "模板名称",
  aliases: "场景别名",
  itemTitle: "检查项",
  applicability: "适用说明",
  hint: "项目提示",
});

Page({
  data: {
    busy: false,
    error: "",
    hasQuery: false,
    official: [],
    personal: [],
    query: "",
    total: 0,
  },

  async onLoad() {
    try {
      await app.ready;
    } catch (error) {
      this.setData({ error: error.message || "无法读取本地模板。" });
    }
  },

  async onShow() {
    try {
      await app.ready;
      this.setData({ busy: false });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "无法读取本地模板。" });
    }
  },

  updateQuery(event) {
    const query = event.detail.value;
    this.setData({ query });
    this.search(query);
  },

  clearQuery() {
    this.setData({ hasQuery: false, official: [], personal: [], query: "", total: 0 });
  },

  search(query) {
    try {
      const normalized = String(query || "").trim();
      if (!normalized) {
        this.setData({ error: "", hasQuery: false, official: [], personal: [], total: 0 });
        return;
      }
      const results = app.service.searchTemplates(normalized);
      const official = results.official.map((result) => ({
        ...result.template,
        matchLabel: result.matches.map((match) => MATCH_LABELS[match]).join("、"),
        score: result.score,
      }));
      const personal = results.personal.map((template) => ({ ...template }));
      this.setData({
        error: "",
        hasQuery: true,
        official,
        personal,
        total: official.length + personal.length,
      });
    } catch (error) {
      this.setData({ error: error.message || "本地搜索失败。" });
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

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/template-detail/template-detail?id=${encodeURIComponent(event.currentTarget.dataset.templateId)}`,
    });
  },

  createTemplate() {
    wx.navigateTo({ url: "/pages/template-edit/template-edit" });
  },
});
