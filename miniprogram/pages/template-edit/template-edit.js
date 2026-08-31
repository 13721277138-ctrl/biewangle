const app = getApp();

const ICONS = Object.freeze(["check", "bag", "home", "heart", "briefcase"]);
const COLORS = Object.freeze(["jade", "ocean", "clay", "plum", "graphite"]);

function itemLines(template) {
  return template.groups
    .reduce((titles, group) => titles.concat(group.items.map((item) => item.title)), [])
    .join("\n");
}

function countLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

Page({
  data: {
    busy: false,
    colors: COLORS,
    error: "",
    icon: "check",
    iconIndex: 0,
    icons: ICONS,
    itemCount: 0,
    itemLines: "",
    loading: true,
    modeLabel: "新建个人模板",
    themeColor: "jade",
    themeColorIndex: 0,
    title: "",
  },

  onLoad(options) {
    this.personalTemplateId = options.id ? decodeURIComponent(options.id) : "";
    this.sourceTemplateId = options.source
      ? decodeURIComponent(options.source)
      : options.copy
        ? decodeURIComponent(options.copy)
        : "";
    this.copying = Boolean(options.copy);
  },

  async onShow() {
    if (this.initialized) return;
    try {
      await app.ready;
      const templateId = this.personalTemplateId || this.sourceTemplateId;
      const template = templateId ? app.service.getTemplate(templateId) : undefined;
      const icon = template && template.icon ? template.icon : "check";
      const themeColor = template && template.themeColor ? template.themeColor : "jade";
      const lines = template ? itemLines(template) : "";
      this.initialized = true;
      this.setData({
        error: "",
        icon,
        iconIndex: Math.max(ICONS.indexOf(icon), 0),
        itemCount: countLines(lines),
        itemLines: lines,
        loading: false,
        modeLabel: this.personalTemplateId
          ? "编辑个人模板"
          : this.copying
            ? "复制个人模板"
            : this.sourceTemplateId
              ? "另存官方副本"
              : "新建个人模板",
        themeColor,
        themeColorIndex: Math.max(COLORS.indexOf(themeColor), 0),
        title: template ? template.title : "",
      });
    } catch (error) {
      this.setData({ error: error.message || "无法准备模板编辑器。", loading: false });
    }
  },

  updateTitle(event) {
    this.setData({ title: event.detail.value });
  },

  updateItems(event) {
    this.setData({
      itemCount: countLines(event.detail.value),
      itemLines: event.detail.value,
    });
  },

  selectIcon(event) {
    const iconIndex = Number(event.detail.value);
    this.setData({ icon: ICONS[iconIndex], iconIndex });
  },

  selectColor(event) {
    const themeColorIndex = Number(event.detail.value);
    this.setData({ themeColor: COLORS[themeColorIndex], themeColorIndex });
  },

  async save() {
    if (this.data.busy) return;
    const title = this.data.title.trim();
    const titles = this.data.itemLines
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!title) {
      this.setData({ error: "请填写模板名称。" });
      return;
    }
    if (titles.length === 0) {
      this.setData({ error: "至少需要一个检查项。" });
      return;
    }

    this.setData({ busy: true, error: "" });
    try {
      await app.service.savePersonalTemplate({
        personalTemplateId: this.personalTemplateId || undefined,
        sourceTemplateId: this.personalTemplateId ? undefined : this.sourceTemplateId || undefined,
        title,
        itemTitles: titles,
        icon: this.data.icon,
        themeColor: this.data.themeColor,
      });
      wx.redirectTo({ url: "/pages/templates/templates" });
    } catch (error) {
      this.setData({
        busy: false,
        error: error.message || "本地保存失败，个人模板未改变。",
      });
    }
  },
});
