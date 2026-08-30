const app = getApp();

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeZoneId() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (_error) {
    return "UTC";
  }
}

function modal(options) {
  return new Promise((resolve) => wx.showModal(Object.assign({}, options, { success: resolve })));
}

Page({
  data: {
    addToCalendar: false,
    busy: false,
    error: "",
    loading: true,
    plans: [],
    scheduledDate: localDate(new Date()),
    scheduledTime: "",
    selectedTemplateIndex: 0,
    selectedTemplateTitle: "",
    templates: [],
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    try {
      await app.ready;
      const snapshot = app.service.getSnapshot();
      const templates = app.service.getVerticalTemplates().map((template) => ({
        templateId: template.templateId,
        title: template.title,
      }));
      const plans = snapshot.plannedChecks
        .filter((plan) => plan.status === "pending")
        .slice()
        .sort((left, right) => {
          const leftWhen = `${left.scheduledDate}T${left.scheduledTime || "00:00"}`;
          const rightWhen = `${right.scheduledDate}T${right.scheduledTime || "00:00"}`;
          return (
            leftWhen.localeCompare(rightWhen) ||
            left.createdAt.localeCompare(right.createdAt) ||
            left.plannedCheckId.localeCompare(right.plannedCheckId)
          );
        })
        .map((plan) => ({
          ...plan,
          when: `${plan.scheduledDate}${plan.scheduledTime ? ` ${plan.scheduledTime}` : "（全天）"}`,
        }));
      const selectedTemplateIndex = Math.min(
        this.data.selectedTemplateIndex,
        Math.max(templates.length - 1, 0),
      );
      this.setData({
        error: "",
        loading: false,
        plans,
        selectedTemplateIndex,
        selectedTemplateTitle: templates[selectedTemplateIndex] ? templates[selectedTemplateIndex].title : "",
        templates,
      });
    } catch (error) {
      this.setData({ error: error.message || "无法读取本地计划。", loading: false });
    }
  },

  selectTemplate(event) {
    const selectedTemplateIndex = Number(event.detail.value);
    const selected = this.data.templates[selectedTemplateIndex];
    this.setData({
      selectedTemplateIndex,
      selectedTemplateTitle: selected ? selected.title : "",
    });
  },

  selectDate(event) {
    this.setData({ scheduledDate: event.detail.value });
  },

  selectTime(event) {
    this.setData({ scheduledTime: event.detail.value });
  },

  clearTime() {
    this.setData({ scheduledTime: "" });
  },

  toggleCalendar(event) {
    this.setData({ addToCalendar: event.detail.value });
  },

  async createPlan() {
    if (this.data.busy) return;
    const template = this.data.templates[this.data.selectedTemplateIndex];
    if (!template) {
      this.setData({ error: "请选择一个检查模板。" });
      return;
    }
    this.setData({ busy: true, error: "" });
    let plan;
    try {
      plan = await app.service.createPlan(template.templateId, {
        createdTimeZoneId: timeZoneId(),
        scheduledDate: this.data.scheduledDate,
        scheduledTime: this.data.scheduledTime || undefined,
      });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，未保存，请重试。" });
      return;
    }

    await this.refresh();
    this.setData({ busy: false });
    if (this.data.addToCalendar) {
      try {
        const result = await app.platform.addCalendarEvent(
          app.platform.calendarEventForPlan(plan),
        );
        wx.showToast({
          title: result.kind === "success" ? "计划已保存并写入日历" : result.message,
          icon: "none",
          duration: 2600,
        });
      } catch (error) {
        this.setData({
          error: `计划已保存在本机，但写入系统日历失败：${error.errMsg || error.message || "请稍后重试"}`,
        });
      }
    } else {
      wx.showToast({ title: "计划已保存到本机", icon: "success" });
    }
  },

  async startPlan(event) {
    if (this.data.busy) return;
    const plannedCheckId = event.currentTarget.dataset.planId;
    this.setData({ busy: true, error: "" });
    try {
      const result = await app.service.startPlan(plannedCheckId);
      wx.redirectTo({ url: `/pages/run/run?id=${encodeURIComponent(result.run.checkRunId)}` });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，未开始检查。" });
    }
  },

  async cancelPlan(event) {
    if (this.data.busy) return;
    const plannedCheckId = event.currentTarget.dataset.planId;
    const decision = await modal({
      title: "取消这项计划？",
      content: "只会把计划记为已取消，不会删除模板或已有检查事实。",
      cancelText: "保留",
      confirmText: "取消计划",
    });
    if (!decision.confirm) return;
    this.setData({ busy: true, error: "" });
    try {
      await app.service.cancelPlan(plannedCheckId);
      await this.refresh();
      this.setData({ busy: false });
    } catch (error) {
      this.setData({ busy: false, error: error.message || "本地保存失败，计划未取消。" });
    }
  },
});
