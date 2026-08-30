const content = require("./generated/official-templates.js");
const domain = require("./lib/domain.js");
const { createWechatChecklistService } = require("./lib/app-service.js");
const { createWechatPlatform } = require("./lib/platform.js");
const { createWxStorageAdapter, WechatDurableStore } = require("./lib/store.js");

function nowIso() {
  return new Date().toISOString();
}

function newId(kind) {
  const random = Math.floor(Math.random() * 0x100000000).toString(36);
  return `${kind}.${Date.now().toString(36)}.${random}`;
}

App({
  onLaunch() {
    const storage = createWxStorageAdapter(wx);
    const store = new WechatDurableStore({
      storage,
      validate: domain.validateSnapshot,
      createInitial: () => domain.createInitialSnapshot(nowIso()),
    });
    this.platform = createWechatPlatform(wx);
    this.service = createWechatChecklistService({
      store,
      templates: content.templates,
      now: nowIso,
      newId,
    });
    this.ready = this.service.initialize().catch((error) => {
      this.startupError = error;
      throw error;
    });
    this.platform.watchForUpdates({
      onReady: () => {
        wx.showModal({
          title: "新版本已准备好",
          content: "更新不会上传或覆盖你的本地清单。现在重启应用吗？",
          confirmText: "现在更新",
          success: (result) => {
            if (result.confirm) this.platform.activateUpdate();
          },
        });
      },
      onFailed: () => wx.showToast({ title: "更新下载失败，可稍后重试", icon: "none" }),
    });
  },
});
