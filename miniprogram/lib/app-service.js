const domain = require("./domain.js");

const VERTICAL_TEMPLATE_IDS = Object.freeze([
  "official.daily_out",
  "official.hotel_checkout",
  "official.international_travel",
  "official.important_medical_visit",
]);

function createWechatChecklistService(options) {
  const store = options.store;
  const templates = options.templates;
  const now = options.now;
  const newId = options.newId;
  let snapshot;
  const listeners = new Set();

  function ensureInitialized() {
    if (!snapshot) throw new Error("本地数据尚未初始化。");
  }

  function publish() {
    const current = domain.clone(snapshot);
    listeners.forEach((listener) => listener(current));
  }

  async function commitCandidate(candidate) {
    const validated = domain.validateSnapshot(candidate);
    await store.commit(validated);
    snapshot = domain.clone(validated);
    publish();
    return domain.clone(snapshot);
  }

  function findOfficialTemplate(templateId) {
    const template = templates.find((candidate) => candidate.templateId === templateId);
    if (!template) throw new Error(`找不到官方模板：${templateId}`);
    return template;
  }

  function findPersonalTemplate(personalTemplateId, includeDeleted) {
    ensureInitialized();
    const template = snapshot.personalTemplates.find(
      (candidate) =>
        candidate.personalTemplateId === personalTemplateId &&
        (includeDeleted === true || candidate.deletedAt === undefined),
    );
    if (!template) throw new Error(`找不到个人模板：${personalTemplateId}`);
    return template;
  }

  function findTemplate(templateId) {
    const official = templates.find((candidate) => candidate.templateId === templateId);
    if (official) return official;
    return findPersonalTemplate(templateId, false);
  }

  function toggleValue(values, value) {
    return values.includes(value)
      ? values.filter((candidate) => candidate !== value)
      : values.concat([value]);
  }

  function buildEditableGroups(personalTemplateId, itemTitles, existingGroups) {
    const titles = itemTitles.map((title) => String(title).trim()).filter(Boolean);
    if (titles.length === 0) throw new Error("至少需要一个检查项。");
    const sourceGroups = existingGroups || [];
    const sourceItems = sourceGroups.reduce(
      (items, group) => items.concat(group.items),
      [],
    );
    return [
      {
        groupId:
          (sourceGroups[0] && sourceGroups[0].groupId) ||
          `${personalTemplateId}.group.main`,
        title:
          sourceGroups.length === 1 && sourceGroups[0]
            ? sourceGroups[0].title
            : "检查项",
        items: titles.map((title, index) => {
          const source = sourceItems[index];
          const item = {
            itemId:
              (source && source.itemId) ||
              `${personalTemplateId}.item.${String(index + 1).padStart(3, "0")}`,
            importance: (source && source.importance) || "normal",
            title,
          };
          if (source && source.condition) item.condition = source.condition;
          if (source && source.hint) item.hint = source.hint;
          return item;
        }),
      },
    ];
  }

  function runFrom(candidate, checkRunId) {
    const run = candidate.checkRuns.find((item) => item.checkRunId === checkRunId);
    if (!run) throw new Error("找不到本次检查。");
    return run;
  }

  async function mutateRun(checkRunId, transition) {
    ensureInitialized();
    const next = domain.clone(snapshot);
    const index = next.checkRuns.findIndex((run) => run.checkRunId === checkRunId);
    if (index < 0) throw new Error("找不到本次检查。");
    const interactedAt = now();
    next.checkRuns[index] = transition(next.checkRuns[index], interactedAt);
    next.updatedAt = interactedAt;
    await commitCandidate(next);
    return domain.clone(next.checkRuns[index]);
  }

  async function initialize() {
    snapshot = domain.validateSnapshot(await store.load());
    publish();
    return domain.clone(snapshot);
  }

  function getSnapshot() {
    ensureInitialized();
    return domain.clone(snapshot);
  }

  function getRun(checkRunId) {
    ensureInitialized();
    return domain.clone(runFrom(snapshot, checkRunId));
  }

  function getRunClosureReceipt(checkRunId) {
    return domain.clone(domain.buildRunClosureReceipt(getRun(checkRunId)));
  }

  function getVerticalTemplates() {
    return templates
      .filter((template) => VERTICAL_TEMPLATE_IDS.includes(template.templateId))
      .map((template) => domain.clone(template));
  }

  function getTemplateLibrary() {
    ensureInitialized();
    return {
      official: templates.map((template) => ({
        template: domain.clone(template),
        favorite: snapshot.settings.favoriteTemplateIds.includes(template.templateId),
        hidden: snapshot.settings.hiddenOfficialTemplateIds.includes(template.templateId),
      })),
      personal: snapshot.personalTemplates
        .filter((template) => template.deletedAt === undefined)
        .map((template) => domain.clone(template)),
      deletedPersonal: snapshot.personalTemplates
        .filter((template) => template.deletedAt !== undefined)
        .map((template) => domain.clone(template)),
    };
  }

  function getTemplate(templateId) {
    ensureInitialized();
    return domain.clone(findTemplate(templateId));
  }

  async function savePersonalTemplate(input) {
    ensureInitialized();
    const title = String(input.title || "").trim();
    if (!title) throw new Error("请填写模板名称。");

    const editing = input.personalTemplateId
      ? findPersonalTemplate(input.personalTemplateId, false)
      : undefined;
    const source = input.sourceTemplateId
      ? findTemplate(input.sourceTemplateId)
      : undefined;
    const savedAt = now();
    const personalTemplateId = editing
      ? editing.personalTemplateId
      : newId("personal");
    const groups = buildEditableGroups(
      personalTemplateId,
      Array.isArray(input.itemTitles) ? input.itemTitles : [],
      (editing && editing.groups) || (source && source.groups) || [],
    );

    let personal;
    if (editing) {
      personal = Object.assign({}, editing, {
        title,
        groups,
        updatedAt: savedAt,
      });
      if (input.icon !== undefined) personal.icon = input.icon;
      if (input.themeColor !== undefined) personal.themeColor = input.themeColor;
    } else if (source && source.templateId) {
      personal = domain.derivePersonalTemplate(
        source,
        {
          title,
          groups,
          icon: input.icon,
          themeColor: input.themeColor,
        },
        savedAt,
        { personalTemplateId },
      );
    } else {
      personal = {
        personalTemplateId,
        title,
        groups,
      };
      if (source && source.derivedFromTemplateId) {
        personal.derivedFromTemplateId = source.derivedFromTemplateId;
      }
      if (source && source.derivedFromContentVersion) {
        personal.derivedFromContentVersion = source.derivedFromContentVersion;
      }
      if (input.icon !== undefined) personal.icon = input.icon;
      else if (source && source.icon) personal.icon = source.icon;
      if (input.themeColor !== undefined) personal.themeColor = input.themeColor;
      else if (source && source.themeColor) personal.themeColor = source.themeColor;
      personal.createdAt = savedAt;
      personal.updatedAt = savedAt;
    }

    const next = domain.clone(snapshot);
    if (editing) {
      next.personalTemplates = next.personalTemplates.map((candidate) =>
        candidate.personalTemplateId === personalTemplateId ? personal : candidate,
      );
    } else {
      next.personalTemplates.push(personal);
    }
    next.updatedAt = savedAt;
    await commitCandidate(next);
    return domain.clone(personal);
  }

  async function softDeletePersonalTemplate(personalTemplateId) {
    ensureInitialized();
    findPersonalTemplate(personalTemplateId, false);
    const deletedAt = now();
    const next = domain.clone(snapshot);
    next.personalTemplates = next.personalTemplates.map((template) =>
      template.personalTemplateId === personalTemplateId
        ? domain.softDeletePersonalTemplate(template, deletedAt)
        : template,
    );
    next.updatedAt = deletedAt;
    await commitCandidate(next);
    return domain.clone(
      next.personalTemplates.find(
        (template) => template.personalTemplateId === personalTemplateId,
      ),
    );
  }

  async function restorePersonalTemplate(personalTemplateId) {
    ensureInitialized();
    const deleted = findPersonalTemplate(personalTemplateId, true);
    if (deleted.deletedAt === undefined) throw new Error("该个人模板并未删除。");
    const restoredAt = now();
    const next = domain.clone(snapshot);
    next.personalTemplates = next.personalTemplates.map((template) =>
      template.personalTemplateId === personalTemplateId
        ? domain.restorePersonalTemplate(template, restoredAt)
        : template,
    );
    next.updatedAt = restoredAt;
    await commitCandidate(next);
    return domain.clone(
      next.personalTemplates.find(
        (template) => template.personalTemplateId === personalTemplateId,
      ),
    );
  }

  async function toggleOfficialSetting(settingKey, templateId) {
    ensureInitialized();
    findOfficialTemplate(templateId);
    const changedAt = now();
    const next = domain.clone(snapshot);
    next.settings[settingKey] = toggleValue(next.settings[settingKey], templateId);
    next.updatedAt = changedAt;
    return commitCandidate(next);
  }

  function toggleFavorite(templateId) {
    return toggleOfficialSetting("favoriteTemplateIds", templateId);
  }

  function toggleHidden(templateId) {
    return toggleOfficialSetting("hiddenOfficialTemplateIds", templateId);
  }

  function searchTemplates(query) {
    ensureInitialized();
    const normalized = String(query || "").trim().toLocaleLowerCase("zh-CN");
    const personal = !normalized
      ? []
      : snapshot.personalTemplates.filter((template) => {
          if (template.deletedAt !== undefined) return false;
          const values = [
            template.title,
            ...template.groups.reduce(
              (titles, group) => titles.concat(group.items.map((item) => item.title)),
              [],
            ),
          ];
          return values.some((value) =>
            value.toLocaleLowerCase("zh-CN").includes(normalized),
          );
        });
    return {
      official: domain.searchTemplates(templates, query),
      personal: domain.clone(personal),
    };
  }

  async function startTemplate(templateId) {
    ensureInitialized();
    const startedAt = now();
    const run = domain.startRun(findTemplate(templateId), startedAt, {
      checkRunId: newId("run"),
    });
    const next = domain.clone(snapshot);
    next.checkRuns.push(run);
    next.updatedAt = startedAt;
    await commitCandidate(next);
    return domain.clone(run);
  }

  function toggleConfirmed(checkRunId, itemId) {
    return mutateRun(checkRunId, (run, interactedAt) =>
      domain.toggleConfirmed(run, itemId, interactedAt),
    );
  }

  function markNotNeeded(checkRunId, itemId) {
    return mutateRun(checkRunId, (run, interactedAt) =>
      domain.markNotNeeded(run, itemId, interactedAt),
    );
  }

  function addTemporaryItem(checkRunId, title, isKey) {
    return mutateRun(checkRunId, (run, interactedAt) =>
      domain.addTemporaryItem(
        run,
        { title, importance: isKey ? "key" : "normal" },
        interactedAt,
        { runItemId: newId("temporary") },
      ),
    );
  }

  function setOneTimeNote(checkRunId, itemId, note) {
    return mutateRun(checkRunId, (run, interactedAt) =>
      domain.setOneTimeNote(run, itemId, note, interactedAt),
    );
  }

  function reorderRunItems(checkRunId, orderedRunItemIds) {
    return mutateRun(checkRunId, (run, interactedAt) =>
      domain.reorderRunItems(run, orderedRunItemIds, interactedAt),
    );
  }

  async function closeRun(checkRunId, keyRiskConfirmed, intent) {
    ensureInitialized();
    const next = domain.clone(snapshot);
    const index = next.checkRuns.findIndex((run) => run.checkRunId === checkRunId);
    if (index < 0) throw new Error("找不到本次检查。");
    const closedAt = now();
    const result = domain.closeRun(next.checkRuns[index], {
      intent: intent || "endWithUnresolved",
      now: closedAt,
      keyRiskConfirmed: keyRiskConfirmed === true,
      closedEventId: newId("closed"),
    });
    if (!result.run) return domain.clone(result);
    next.checkRuns[index] = result.run;
    next.updatedAt = closedAt;
    await commitCandidate(next);
    return domain.clone(result);
  }

  async function createPlan(templateId, input) {
    ensureInitialized();
    const createdAt = now();
    const plan = domain.createPlannedCheck(findTemplate(templateId), {
      plannedCheckId: newId("plan"),
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      createdTimeZoneId: input.createdTimeZoneId,
      now: createdAt,
    });
    const next = domain.clone(snapshot);
    next.plannedChecks.push(plan);
    next.updatedAt = createdAt;
    await commitCandidate(next);
    return domain.clone(plan);
  }

  async function startPlan(plannedCheckId) {
    ensureInitialized();
    const next = domain.clone(snapshot);
    const index = next.plannedChecks.findIndex((plan) => plan.plannedCheckId === plannedCheckId);
    if (index < 0) throw new Error("找不到该计划。");
    const startedAt = now();
    const result = domain.startPlannedCheck(next.plannedChecks[index], startedAt, {
      checkRunId: newId("run"),
    });
    next.plannedChecks[index] = result.plan;
    next.checkRuns.push(result.run);
    next.updatedAt = startedAt;
    await commitCandidate(next);
    return domain.clone(result);
  }

  async function cancelPlan(plannedCheckId) {
    ensureInitialized();
    const next = domain.clone(snapshot);
    const index = next.plannedChecks.findIndex((plan) => plan.plannedCheckId === plannedCheckId);
    if (index < 0) throw new Error("找不到该计划。");
    next.plannedChecks[index] = domain.cancelPlannedCheck(next.plannedChecks[index]);
    next.updatedAt = now();
    await commitCandidate(next);
    return domain.clone(next.plannedChecks[index]);
  }

  async function reopenRun(checkRunId) {
    ensureInitialized();
    const next = domain.clone(snapshot);
    const index = next.checkRuns.findIndex((run) => run.checkRunId === checkRunId);
    if (index < 0) throw new Error("找不到本次检查。");
    const reopenedAt = now();
    const result = domain.reopenRun(next.checkRuns[index], reopenedAt);
    if (!result.run) return domain.clone(result);
    next.checkRuns[index] = result.run;
    next.updatedAt = reopenedAt;
    await commitCandidate(next);
    return domain.clone(result);
  }

  async function restartFromHistory(checkRunId) {
    ensureInitialized();
    const source = runFrom(snapshot, checkRunId);
    if (source.status === "inProgress") {
      throw new Error("进行中的检查不能从历史重新开始。");
    }
    const restartedAt = now();
    const run = domain.restartFromHistory(source, restartedAt, {
      checkRunId: newId("run"),
    });
    const next = domain.clone(snapshot);
    next.checkRuns.push(run);
    next.updatedAt = restartedAt;
    await commitCandidate(next);
    return domain.clone(run);
  }

  function exportBackup() {
    ensureInitialized();
    const envelope = domain.exportBackup(snapshot, "wechat", now());
    return { envelope, text: `${JSON.stringify(envelope, null, 2)}\n` };
  }

  async function createBackup() {
    ensureInitialized();
    const exportedAt = now();
    const next = domain.clone(snapshot);
    next.lastBackupAt = exportedAt;
    next.updatedAt = exportedAt;
    const committed = await commitCandidate(next);
    const envelope = domain.exportBackup(committed, "wechat", exportedAt);
    return { envelope, text: `${JSON.stringify(envelope, null, 2)}\n` };
  }

  function readableExport() {
    ensureInitialized();
    return domain.buildReadableExport(snapshot);
  }

  function previewBackup(raw) {
    const envelope = domain.parseAndValidateBackup(raw);
    return {
      exportedAt: envelope.exportedAt,
      personalTemplates: envelope.data.personalTemplates.length,
      plans: envelope.data.plannedChecks.length,
      runs: envelope.data.checkRuns.length,
    };
  }

  async function restoreBackup(raw) {
    ensureInitialized();
    await store.protectiveCopy("before-restore");
    const envelope = domain.parseAndValidateBackup(raw);
    return commitCandidate(envelope.data);
  }

  async function resetAll(expectedUpdatedAt) {
    ensureInitialized();
    if (snapshot.updatedAt !== expectedUpdatedAt) {
      throw new Error("确认后数据发生了变化，请重新检查后再清空。");
    }
    const prepared = domain.prepareReset(snapshot, now());
    await store.protectiveCopy(prepared.protectiveCopyLabel);
    return commitCandidate(prepared.next);
  }

  function shareRunText(checkRunId) {
    return domain.buildRunShareText(getRun(checkRunId));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    addTemporaryItem,
    cancelPlan,
    closeRun,
    createBackup,
    createPlan,
    exportBackup,
    getRun,
    getRunClosureReceipt,
    getSnapshot,
    getTemplate,
    getTemplateLibrary,
    getVerticalTemplates,
    initialize,
    markNotNeeded,
    previewBackup,
    readableExport,
    reorderRunItems,
    reopenRun,
    resetAll,
    restartFromHistory,
    restoreBackup,
    restorePersonalTemplate,
    savePersonalTemplate,
    searchTemplates,
    setOneTimeNote,
    shareRunText,
    softDeletePersonalTemplate,
    startPlan,
    startTemplate,
    subscribe,
    toggleConfirmed,
    toggleFavorite,
    toggleHidden,
  };
}

module.exports = { VERTICAL_TEMPLATE_IDS, createWechatChecklistService };
