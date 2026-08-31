const app = getApp();

function modal(options) {
  return new Promise((resolve) => wx.showModal(Object.assign({}, options, { success: resolve })));
}

Page({
  data: {
    busy: false,
    error: "",
    loading: true,
    template: null,
  },

  onLoad(options) {
    this.templateId = decodeURIComponent(options.id || "");
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const template = app.service.getTemplate(this.templateId);
      const isOfficial = Object.prototype.hasOwnProperty.call(template, "templateId");
      let favorite = false;
      let hidden = false;
      if (isOfficial) {
        const entry = app.service.getTemplateLibrary().official.find(
          (candidate) => candidate.template.templateId === template.templateId,
        );
        favorite = Boolean(entry && entry.favorite);
        hidden = Boolean(entry && entry.hidden);
      }
      this.setData({
        busy: false,
        error: "",
        loading: false,
        template: {
          ...template,
          favorite,
          hidden,
          isOfficial,
          sourceId: isOfficial ? template.templateId : template.personalTemplateId,
          itemCount: template.groups.reduce((count, group) => count + group.items.length, 0),
          groups: template.groups.map((group) => ({
            ...group,
            items: group.items.map((item) => ({ ...item, isKey: item.importance === "key" })),
          })),
        },
      });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "无法读取模板详情。", loading: false });
    }
  },

  async persist(action, successTitle) {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      await action();
      await this.refresh();
      this.setData({ busy: false });
      if (successTitle) wx.showToast({ title: successTitle, icon: "success" });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，事实未改变。" });
    }
  },

  async startTemplate() {
    if (!this.data.template || this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      const run = await app.service.startTemplate(this.data.template.sourceId);
      wx.navigateTo({ url: `/pages/run/run?id=${encodeURIComponent(run.checkRunId)}` });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，未开始检查。" });
    }
  },

  createPlan() {
    wx.navigateTo({
      url: `/pages/plans/plans?template=${encodeURIComponent(this.data.template.sourceId)}`,
    });
  },

  toggleFavorite() {
    return this.persist(
      () => app.service.toggleFavorite(this.data.template.templateId),
      "收藏状态已保存",
    );
  },

  toggleHidden() {
    return this.persist(
      () => app.service.toggleHidden(this.data.template.templateId),
      "入口状态已保存",
    );
  },

  editPersonal() {
    wx.navigateTo({
      url: `/pages/template-edit/template-edit?id=${encodeURIComponent(this.data.template.personalTemplateId)}`,
    });
  },

  copyPersonal() {
    wx.navigateTo({
      url: `/pages/template-edit/template-edit?copy=${encodeURIComponent(this.data.template.personalTemplateId)}`,
    });
  },

  deriveOfficial() {
    wx.navigateTo({
      url: `/pages/template-edit/template-edit?source=${encodeURIComponent(this.data.template.templateId)}`,
    });
  },

  async deletePersonal() {
    const decision = await modal({
      title: "删除这个个人模板？",
      content: "会移入可恢复的已删除模板；已有运行、计划与历史快照不会被改写。",
      cancelText: "保留",
      confirmText: "移入已删除",
    });
    if (!decision.confirm) return;
    if (this.data.busy) return;
    this.setData({ busy: true, error: "" });
    try {
      await app.service.softDeletePersonalTemplate(this.data.template.personalTemplateId);
      wx.navigateBack({ delta: 1 });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，模板未删除。" });
    }
  },
});
