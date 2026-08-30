const app = getApp();

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
    capabilities: {},
    error: "",
    facts: {},
    loading: true,
    preview: null,
  },

  async onShow() {
    try {
      await app.ready;
      const snapshot = app.service.getSnapshot();
      this.setData({
        capabilities: app.platform.capabilities(),
        error: "",
        facts: {
          checkRuns: snapshot.checkRuns.length,
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

  prepareBackup() {
    const backup = app.service.exportBackup();
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
    return backup;
  },

  async copyBackup() {
    try {
      const backup = this.prepareBackup();
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
      const backup = this.prepareBackup();
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
});
