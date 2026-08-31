function unavailable(message) {
  return Promise.resolve({ kind: "unavailable", message });
}

function callNative(wxApi, method, input) {
  return new Promise((resolve, reject) => {
    wxApi[method](
      Object.assign({}, input, {
        success: () => resolve({ kind: "success" }),
        fail: (error) => reject(error),
      }),
    );
  });
}

function localUnixSeconds(localDate, localTime) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(localDate || ""));
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(localTime || ""));
  if (!dateMatch || !timeMatch) throw new Error("计划日期或时间格式无效，未写入系统日历。");
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error("计划日期不存在，未写入系统日历。");
  }
  return Math.floor(date.getTime() / 1000);
}

function calendarEventForPlan(plan) {
  const hasTime = typeof plan.scheduledTime === "string";
  return {
    title: `别忘了：${plan.plannedTemplateSnapshot.title}`,
    startTime: localUnixSeconds(plan.scheduledDate, plan.scheduledTime || "00:00"),
    allDay: !hasTime,
    description: "打开“别忘了”微信小程序开始检查。计划事实仍仅保存在本机。",
  };
}

function createWechatPlatform(wxApi) {
  const api = wxApi || {};

  function capabilities() {
    return {
      clipboard: typeof api.setClipboardData === "function",
      calendar: typeof api.addPhoneCalendar === "function",
      chatFileImport:
        typeof api.chooseMessageFile === "function" && typeof api.getFileSystemManager === "function",
      fileShare: typeof api.shareFileMessage === "function",
      updateManager: typeof api.getUpdateManager === "function",
      subscriptionMessages: "unavailable",
    };
  }

  function copyText(text) {
    if (typeof api.setClipboardData !== "function") {
      return unavailable("当前微信版本不支持复制；可以先查看文本后手动处理。");
    }
    return callNative(api, "setClipboardData", { data: String(text) });
  }

  function addCalendarEvent(event) {
    if (typeof api.addPhoneCalendar !== "function") {
      return unavailable("当前微信版本不支持写入系统日历；计划仍已保存在本机。");
    }
    return callNative(api, "addPhoneCalendar", event || {});
  }

  function shareFile(input) {
    if (typeof api.shareFileMessage !== "function") {
      return unavailable("当前微信版本不支持直接分享文件；可以改用复制备份文本。");
    }
    return callNative(api, "shareFileMessage", input || {});
  }

  function chooseBackupText(maxBytes) {
    if (typeof api.chooseMessageFile !== "function" || typeof api.getFileSystemManager !== "function") {
      return unavailable("当前微信版本不支持从聊天选择备份文件；当前数据未改变。");
    }
    return new Promise((resolve, reject) => {
      api.chooseMessageFile({
        count: 1,
        type: "file",
        extension: ["json"],
        success: (result) => {
          const file = result && Array.isArray(result.tempFiles) ? result.tempFiles[0] : undefined;
          if (!file || typeof file.path !== "string" || typeof file.size !== "number") {
            reject(new Error("没有读取到有效的微信聊天文件；当前数据未改变。"));
            return;
          }
          if (file.size > maxBytes) {
            const limitMb = Math.floor(maxBytes / (1024 * 1024));
            reject(new Error(`备份文件超过 ${limitMb} MB 上限；当前数据未改变。`));
            return;
          }
          let manager;
          try {
            manager = api.getFileSystemManager();
          } catch (error) {
            reject(error);
            return;
          }
          manager.readFile({
            filePath: file.path,
            encoding: "utf8",
            success: (readResult) => {
              if (!readResult || typeof readResult.data !== "string") {
                reject(new Error("备份文件不是可读取的 UTF-8 文本；当前数据未改变。"));
                return;
              }
              resolve({
                kind: "success",
                name: typeof file.name === "string" ? file.name : "backup.json",
                size: file.size,
                text: readResult.data,
              });
            },
            fail: reject,
          });
        },
        fail: reject,
      });
    });
  }

  function activateUpdate() {
    if (typeof api.getUpdateManager !== "function") {
      return { kind: "unavailable", message: "当前微信版本不支持应用内更新管理。" };
    }
    const manager = api.getUpdateManager();
    if (!manager || typeof manager.applyUpdate !== "function") {
      return { kind: "unavailable", message: "暂时没有可应用的更新。" };
    }
    manager.applyUpdate();
    return { kind: "success" };
  }

  function watchForUpdates(callbacks) {
    if (typeof api.getUpdateManager !== "function") return { kind: "unavailable" };
    const manager = api.getUpdateManager();
    if (manager && typeof manager.onCheckForUpdate === "function") {
      manager.onCheckForUpdate((result) => {
        if (callbacks && callbacks.onCheck) callbacks.onCheck(Boolean(result && result.hasUpdate));
      });
    }
    if (manager && typeof manager.onUpdateReady === "function") {
      manager.onUpdateReady(() => {
        if (callbacks && callbacks.onReady) callbacks.onReady();
      });
    }
    if (manager && typeof manager.onUpdateFailed === "function") {
      manager.onUpdateFailed(() => {
        if (callbacks && callbacks.onFailed) callbacks.onFailed();
      });
    }
    return { kind: "watching" };
  }

  return {
    activateUpdate,
    addCalendarEvent,
    calendarEventForPlan,
    capabilities,
    chooseBackupText,
    copyText,
    shareFile,
    watchForUpdates,
  };
}

module.exports = { calendarEventForPlan, createWechatPlatform, localUnixSeconds };
