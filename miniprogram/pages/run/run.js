const app = getApp();

function stateLabel(state) {
  if (state === "confirmed") return "已确认";
  if (state === "notNeeded") return "本次不需要";
  return "未确认";
}

function statusLabel(status) {
  if (status === "inProgress") return "进行中";
  if (status === "completed") return "已完成";
  if (status === "endedWithUnresolved") return "有未确认项结束";
  return "已放弃";
}

function modal(options) {
  return new Promise((resolve) => wx.showModal(Object.assign({}, options, { success: resolve })));
}

Page({
  data: {
    busy: false,
    editingItemId: "",
    editingNote: "",
    error: "",
    loading: true,
    run: null,
    tempIsKey: false,
    tempTitle: "",
  },

  onLoad(options) {
    this.checkRunId = decodeURIComponent(options.id || "");
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const run = app.service.getRun(this.checkRunId);
      const items = run.items
        .slice()
        .sort((left, right) => left.runSortOrder - right.runSortOrder)
        .map((item) => ({
          ...item,
          isConfirmed: item.state === "confirmed",
          isKey: item.importance === "key",
          isNotNeeded: item.state === "notNeeded",
          stateLabel: stateLabel(item.state),
        }));
      const unresolved = items.filter((item) => item.state === "unchecked");
      this.setData({
        error: "",
        loading: false,
        run: {
          ...run,
          items,
          isInProgress: run.status === "inProgress",
          statusLabel: statusLabel(run.status),
          unresolvedCount: unresolved.length,
          unresolvedKeyCount: unresolved.filter((item) => item.importance === "key").length,
        },
      });
    } catch (error) {
      this.setData({ error: error.message || "无法读取本次检查。", loading: false });
    }
  },

  async persist(action, afterCommit) {
    if (this.data.busy) return false;
    this.setData({ busy: true, error: "" });
    try {
      await action();
      if (afterCommit) afterCommit();
      await this.refresh();
      this.setData({ busy: false });
      return true;
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，未保存，请重试。" });
      return false;
    }
  },

  toggleConfirmed(event) {
    const itemId = event.currentTarget.dataset.itemId;
    return this.persist(() => app.service.toggleConfirmed(this.checkRunId, itemId));
  },

  markNotNeeded(event) {
    const itemId = event.currentTarget.dataset.itemId;
    return this.persist(() => app.service.markNotNeeded(this.checkRunId, itemId));
  },

  updateTempTitle(event) {
    this.setData({ tempTitle: event.detail.value });
  },

  updateTempImportance(event) {
    this.setData({ tempIsKey: event.detail.value });
  },

  async addTemporaryItem() {
    const title = this.data.tempTitle.trim();
    if (!title) {
      this.setData({ error: "请先输入临时检查项。" });
      return;
    }
    await this.persist(
      () => app.service.addTemporaryItem(this.checkRunId, title, this.data.tempIsKey),
      () => this.setData({ tempTitle: "", tempIsKey: false }),
    );
  },

  beginNote(event) {
    const item = this.data.run.items.find(
      (candidate) => candidate.runItemId === event.currentTarget.dataset.itemId,
    );
    if (!item) return;
    this.setData({ editingItemId: item.runItemId, editingNote: item.oneTimeNote || "" });
  },

  updateNote(event) {
    this.setData({ editingNote: event.detail.value });
  },

  async saveNote() {
    const itemId = this.data.editingItemId;
    await this.persist(
      () => app.service.setOneTimeNote(this.checkRunId, itemId, this.data.editingNote.trim()),
      () => this.setData({ editingItemId: "", editingNote: "" }),
    );
  },

  cancelNote() {
    this.setData({ editingItemId: "", editingNote: "" });
  },

  async finishRun() {
    if (this.data.busy) return;
    const unresolvedCount = this.data.run.unresolvedCount;
    if (unresolvedCount === 0) {
      let result;
      const committed = await this.persist(async () => {
        result = await app.service.closeRun(this.checkRunId, false, "complete");
      });
      if (committed && result.kind === "completed") {
        wx.redirectTo({ url: "/pages/history/history" });
      } else if (committed) {
        this.setData({ error: "检查事实已变化，未记录为完成；请重新核对当前项目。" });
      }
      return;
    }

    const firstDecision = await modal({
      title: `还有 ${unresolvedCount} 项未确认`,
      content: "可以返回继续检查，或明确以“有未确认项”结束；系统不会把它伪装成完成。",
      cancelText: "继续检查",
      confirmText: "仍然结束",
    });
    if (!firstDecision.confirm) return;

    let result;
    const firstCommitted = await this.persist(async () => {
      result = await app.service.closeRun(this.checkRunId, false, "endWithUnresolved");
    });
    if (!firstCommitted) return;

    if (result.kind === "needsKeyConfirmation") {
      const keyDecision = await modal({
        title: `仍有 ${result.unresolvedKeyCount} 个关键项`,
        content: "请确认你已理解这些关键项尚未核实。确认后会如实记录“有未确认项结束”。",
        cancelText: "返回检查",
        confirmText: "确认风险",
      });
      if (!keyDecision.confirm) return;
      let confirmedResult;
      const committed = await this.persist(async () => {
        confirmedResult = await app.service.closeRun(this.checkRunId, true, "endWithUnresolved");
      });
      if (!committed) return;
      if (confirmedResult.kind !== "endedWithUnresolved") {
        this.setData({ error: "关键风险确认未形成有效结束事实，请重新检查。" });
        return;
      }
    } else if (result.kind !== "endedWithUnresolved") {
      this.setData({ error: "未形成有效的结束事实，请重新检查。" });
      return;
    }
    wx.redirectTo({ url: "/pages/history/history" });
  },

  async discardRun() {
    if (this.data.busy) return;
    const decision = await modal({
      title: "放弃本次检查？",
      content: "这会保留一条“已放弃”事实记录，不会把本次操作算作完成。",
      cancelText: "保留",
      confirmText: "确认放弃",
    });
    if (!decision.confirm) return;
    let result;
    const committed = await this.persist(async () => {
      result = await app.service.closeRun(this.checkRunId, false, "discard");
    });
    if (committed && result.kind === "discarded") {
      wx.redirectTo({ url: "/pages/history/history" });
    } else if (committed) {
      this.setData({ error: "没有形成“已放弃”事实，当前检查保持不变。" });
    }
  },

  async copySummary() {
    try {
      const result = await app.platform.copyText(app.service.shareRunText(this.checkRunId));
      wx.showToast({ title: result.kind === "success" ? "摘要已复制" : result.message, icon: "none" });
    } catch (error) {
      this.setData({ error: error.errMsg || error.message || "复制失败，请重试。" });
    }
  },

  onShareAppMessage() {
    const run = this.data.run;
    return {
      title: run ? `别忘了｜${run.runTemplateSnapshot.title}（${run.statusLabel}）` : "别忘了",
      path: "/pages/home/home",
    };
  },
});
