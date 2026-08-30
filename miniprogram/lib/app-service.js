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

  function findTemplate(templateId) {
    const template = templates.find((candidate) => candidate.templateId === templateId);
    if (!template) throw new Error(`找不到官方模板：${templateId}`);
    return template;
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

  function getVerticalTemplates() {
    return templates
      .filter((template) => VERTICAL_TEMPLATE_IDS.includes(template.templateId))
      .map((template) => domain.clone(template));
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

  function exportBackup() {
    ensureInitialized();
    const envelope = domain.exportBackup(snapshot, "wechat", now());
    return { envelope, text: `${JSON.stringify(envelope, null, 2)}\n` };
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
    createPlan,
    exportBackup,
    getRun,
    getSnapshot,
    getVerticalTemplates,
    initialize,
    markNotNeeded,
    reopenRun,
    setOneTimeNote,
    shareRunText,
    startPlan,
    startTemplate,
    subscribe,
    toggleConfirmed,
  };
}

module.exports = { VERTICAL_TEMPLATE_IDS, createWechatChecklistService };
