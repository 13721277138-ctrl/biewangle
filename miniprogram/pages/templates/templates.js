const app = getApp();

function itemCount(template) {
  return template.groups.reduce((count, group) => count + group.items.length, 0);
}

function modal(options) {
  return new Promise((resolve) => wx.showModal(Object.assign({}, options, { success: resolve })));
}

Page({
  data: {
    busy: false,
    deletedPersonal: [],
    error: "",
    loading: true,
    official: [],
    personal: [],
    showDeleted: false,
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const library = app.service.getTemplateLibrary();
      this.setData({
        busy: false,
        deletedPersonal: library.deletedPersonal.map((template) => ({
          ...template,
          itemCount: itemCount(template),
        })),
        error: "",
        loading: false,
        official: library.official.map((entry) => ({
          ...entry.template,
          favorite: entry.favorite,
          hidden: entry.hidden,
          itemCount: itemCount(entry.template),
        })),
        personal: library.personal.map((template) => ({
          ...template,
          itemCount: itemCount(template),
        })),
      });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "无法读取模板库。", loading: false });
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
      this.setData({
        busy: false,
        error: error.message || "本地保存失败，当前模板事实未改变。",
      });
    }
  },

  openSearch() {
    wx.navigateTo({ url: "/pages/search/search" });
  },

  createTemplate() {
    wx.navigateTo({ url: "/pages/template-edit/template-edit" });
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/template-detail/template-detail?id=${encodeURIComponent(event.currentTarget.dataset.templateId)}`,
    });
  },

  editPersonal(event) {
    wx.navigateTo({
      url: `/pages/template-edit/template-edit?id=${encodeURIComponent(event.currentTarget.dataset.templateId)}`,
    });
  },

  copyPersonal(event) {
    wx.navigateTo({
      url: `/pages/template-edit/template-edit?copy=${encodeURIComponent(event.currentTarget.dataset.templateId)}`,
    });
  },

  deriveOfficial(event) {
    wx.navigateTo({
      url: `/pages/template-edit/template-edit?source=${encodeURIComponent(event.currentTarget.dataset.templateId)}`,
    });
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

  toggleFavorite(event) {
    return this.persist(
      () => app.service.toggleFavorite(event.currentTarget.dataset.templateId),
      "收藏状态已保存",
    );
  },

  toggleHidden(event) {
    return this.persist(
      () => app.service.toggleHidden(event.currentTarget.dataset.templateId),
      "入口状态已保存",
    );
  },

  async deletePersonal(event) {
    const decision = await modal({
      title: "移入已删除模板？",
      content: "只会软删除个人模板；既有计划、运行和历史快照不会改变，也可以稍后恢复。",
      cancelText: "保留",
      confirmText: "移入已删除",
    });
    if (!decision.confirm) return;
    return this.persist(
      () => app.service.softDeletePersonalTemplate(event.currentTarget.dataset.templateId),
      "已移入已删除模板",
    );
  },

  restorePersonal(event) {
    return this.persist(
      () => app.service.restorePersonalTemplate(event.currentTarget.dataset.templateId),
      "个人模板已恢复",
    );
  },

  toggleDeleted() {
    this.setData({ showDeleted: !this.data.showDeleted });
  },
});
