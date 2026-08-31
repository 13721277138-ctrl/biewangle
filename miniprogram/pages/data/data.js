const app = getApp();
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

function modal(options) {
  return new Promise((resolve) => wx.showModal(Object.assign({}, options, { success: resolve })));
}

function writeTextFile(path, text) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath: path,
      data: text,
      encoding: "utf8",
      success: resolve,
      fail: reject,
    });
  });
}

Page({
  data: {
    busy: false,
    capabilities: {},
    error: "",
    facts: {},
    importFileName: "",
    importPreview: null,
    loading: true,
    preview: null,
    resetPhrase: "",
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const snapshot = app.service.getSnapshot();
      this.setData({
        capabilities: app.platform.capabilities(),
        error: "",
        facts: {
          checkRuns: snapshot.checkRuns.length,
          lastBackupAt: snapshot.lastBackupAt || "",
          personalTemplates: snapshot.personalTemplates.length,
          plannedChecks: snapshot.plannedChecks.length,
          schemaVersion: snapshot.schemaVersion,
          updatedAt: snapshot.updatedAt,
        },
        loading: false,
      });
    } catch (error) {
      this.setData({ error: error.message || "无法读取本地数据。", loading: false });
    }
  },

  async prepareBackup() {
    const backup = await app.service.createBackup();
    this.currentBackup = backup;
    this.setData({
      preview: {
        appVersion: backup.envelope.appVersion,
        exportedAt: backup.envelope.exportedAt,
        officialContentVersion: backup.envelope.officialContentVersion,
        schemaVersion: backup.envelope.schemaVersion,
        sourcePlatform: backup.envelope.sourcePlatform,
      },
    });
    await this.refresh();
    return backup;
  },

  async copyBackup() {
    try {
      const backup = await this.prepareBackup();
      const result = await app.platform.copyText(backup.text);
      wx.showToast({
        title: result.kind === "success" ? "完整备份已复制" : result.message,
        icon: "none",
        duration: 2800,
      });
    } catch (error) {
      this.setData({ error: error.errMsg || error.message || "复制备份失败，请重试。" });
    }
  },

  async shareBackupFile() {
    try {
      const backup = await this.prepareBackup();
      if (!this.data.capabilities.fileShare) {
        wx.showModal({
          title: "当前不能直接分享文件",
          content: "此微信版本没有可靠的文件分享能力。请使用“复制完整备份”；系统不会伪装成已经分享。",
          showCancel: false,
        });
        return;
      }
      if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) {
        throw new Error("当前环境没有可靠的临时文件能力，请改用复制完整备份。");
      }
      const filePath = `${wx.env.USER_DATA_PATH}/biewangle-backup-${Date.now()}.json`;
      await writeTextFile(filePath, backup.text);
      const result = await app.platform.shareFile({
        filePath,
        fileName: `别忘了备份-${backup.envelope.exportedAt.slice(0, 10)}.json`,
      });
      wx.showToast({
        title: result.kind === "success" ? "已打开文件分享" : result.message,
        icon: "none",
        duration: 2800,
      });
    } catch (error) {
      this.setData({ error: error.errMsg || error.message || "备份文件分享失败，请改用复制。" });
    }
  },

  async copyReadableExport() {
    try {
      const result = await app.platform.copyText(app.service.readableExport());
      wx.showToast({
        title: result.kind === "success" ? "可读导出已复制" : result.message,
        icon: "none",
        duration: 2800,
      });
    } catch (error) {
      this.setData({ error: error.errMsg || error.message || "复制可读导出失败，请重试。" });
    }
  },

  async chooseBackup() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: "", importFileName: "", importPreview: null });
    try {
      const selected = await app.platform.chooseBackupText(MAX_BACKUP_BYTES);
      if (selected.kind !== "success") {
        this.setData({ busy: false });
        await modal({
          title: "当前不能选择文件",
          content: selected.message,
          showCancel: false,
        });
        return;
      }
      const preview = app.service.previewBackup(selected.text);
      this.pendingImportText = selected.text;
      this.setData({
        busy: false,
        importFileName: selected.name,
        importPreview: {
          ...preview,
          sizeKb: Math.max(1, Math.ceil(selected.size / 1024)),
        },
      });
    } catch (error) {
      const message = error.errMsg || error.message || "无法读取备份文件。";
      if (/cancel/i.test(message)) {
        this.setData({ busy: false });
        return;
      }
      this.pendingImportText = undefined;
      this.setData({ busy: false, error: `${message} 当前数据未改变。` });
    }
  },

  async restoreSelected() {
    if (this.data.busy || !this.pendingImportText || !this.data.importPreview) return;
    const preview = this.data.importPreview;
    const decision = await modal({
      title: "恢复这份备份？",
      content: `将用备份中的 ${preview.personalTemplates} 个个人模板、${preview.plans} 项计划和 ${preview.runs} 次检查替换当前数据。执行前会先创建当前数据保护副本。`,
      cancelText: "取消",
      confirmText: "确认恢复",
    });
    if (!decision.confirm) return;
    this.setData({ busy: true, error: "" });
    try {
      await app.service.restoreBackup(this.pendingImportText);
      this.pendingImportText = undefined;
      this.setData({ importFileName: "", importPreview: null, busy: false });
      await this.refresh();
      await modal({
        title: "恢复完成",
        content: "备份已通过严格校验并完成双槽提交；恢复前的本地事实已保留为保护副本。",
        showCancel: false,
      });
    } catch (error) {
      this.setData({
        busy: false,
        error: `${error.message || "恢复失败"} 当前事实未被部分覆盖。`,
      });
    }
  },

  updateResetPhrase(event) {
    this.setData({ resetPhrase: event.detail.value });
  },

  async resetAll() {
    if (this.data.busy) return;
    if (this.data.resetPhrase.trim() !== "全部重置") {
      this.setData({ error: "请输入完整确认文字“全部重置”。" });
      return;
    }
    const expectedUpdatedAt = app.service.getSnapshot().updatedAt;
    const decision = await modal({
      title: "最后确认清空？",
      content: "将清空个人模板、计划、运行和历史，以及收藏/隐藏设置。执行前会创建当前数据保护副本。",
      cancelText: "取消",
      confirmText: "确认清空",
    });
    if (!decision.confirm) return;
    this.setData({ busy: true, error: "" });
    try {
      await app.service.resetAll(expectedUpdatedAt);
      this.pendingImportText = undefined;
      this.setData({
        busy: false,
        importFileName: "",
        importPreview: null,
        resetPhrase: "",
      });
      await this.refresh();
      wx.showToast({ title: "本地数据已清空", icon: "success" });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "清空失败，当前数据未改变。" });
    }
  },
});
