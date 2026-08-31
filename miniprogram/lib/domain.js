const APP_VERSION = "1.1.0";
const SCHEMA_VERSION = 1;
const OFFICIAL_CONTENT_VERSION = 1;
const REOPEN_WINDOW_HOURS = 2;
const STALE_AFTER_HOURS = 24;
const SEARCH_WEIGHTS = Object.freeze({
  title: 500,
  aliases: 400,
  itemTitle: 300,
  applicability: 200,
  hint: 100,
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertExactKeys(value, required, optional, description) {
  assert(isRecord(value), `${description}结构无效。`);
  const allowed = new Set(required.concat(optional || []));
  required.forEach((key) => assert(hasOwn(value, key), `${description}缺少字段 ${key}。`));
  Object.keys(value).forEach((key) =>
    assert(allowed.has(key), `${description}包含未知字段 ${key}。`),
  );
}

function assertNonEmptyString(value, description) {
  assert(typeof value === "string" && value.length > 0, `${description}必须是非空文本。`);
}

function assertOptionalNonEmptyString(value, description) {
  if (value !== undefined) assertNonEmptyString(value, description);
}

function assertInteger(value, minimum, description) {
  assert(Number.isSafeInteger(value) && value >= minimum, `${description}必须是有效整数。`);
}

function assertIsoDateTime(value, description) {
  const pattern = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  const match = typeof value === "string" ? pattern.exec(value) : null;
  const year = match ? Number(match[1]) : 0;
  const month = match ? Number(match[2]) : 0;
  const day = match ? Number(match[3]) : 0;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  assert(
    match !== null && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1],
    `${description}必须是带时区的 ISO 日期时间。`,
  );
}

function assertOptionalIsoDateTime(value, description) {
  if (value !== undefined) assertIsoDateTime(value, description);
}

function assertUnique(values, description) {
  assert(new Set(values).size === values.length, `${description}存在重复标识。`);
}

function factsMatch(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => factsMatch(entry, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => hasOwn(right, key) && factsMatch(left[key], right[key]))
  );
}

function validateTemplateItem(item, description) {
  assertExactKeys(item, ["itemId", "importance", "title"], ["condition", "hint"], description);
  assertNonEmptyString(item.itemId, `${description}项目标识`);
  assert(["normal", "key"].includes(item.importance), `${description}重要性无效。`);
  assertNonEmptyString(item.title, `${description}标题`);
  assertOptionalNonEmptyString(item.condition, `${description}条件`);
  assertOptionalNonEmptyString(item.hint, `${description}提示`);
}

function validateTemplateGroup(group, description) {
  assertExactKeys(group, ["groupId", "title", "items"], [], description);
  assertNonEmptyString(group.groupId, `${description}分组标识`);
  assertNonEmptyString(group.title, `${description}标题`);
  assert(Array.isArray(group.items) && group.items.length > 0, `${description}缺少项目。`);
  group.items.forEach((item, index) => validateTemplateItem(item, `${description}项目 ${index + 1}`));
}

function validateTemplateSnapshot(snapshot, description) {
  assertExactKeys(snapshot, ["title", "groups"], ["applicability"], description);
  assertNonEmptyString(snapshot.title, `${description}标题`);
  assertOptionalNonEmptyString(snapshot.applicability, `${description}适用说明`);
  assert(Array.isArray(snapshot.groups) && snapshot.groups.length > 0, `${description}缺少分组。`);
  snapshot.groups.forEach((group, index) => validateTemplateGroup(group, `${description}分组 ${index + 1}`));
  assertUnique(snapshot.groups.map((group) => group.groupId), `${description}分组`);
  assertUnique(
    snapshot.groups.reduce((items, group) => items.concat(group.items.map((item) => item.itemId)), []),
    `${description}项目`,
  );
}

function validateTemplateIdentity(identity, description) {
  assert(isRecord(identity), `${description}结构无效。`);
  if (identity.kind === "official") {
    assertExactKeys(identity, ["kind", "templateId", "contentVersion"], [], description);
    assert(
      typeof identity.templateId === "string" && identity.templateId.startsWith("official."),
      `${description}官方模板标识无效。`,
    );
    assertInteger(identity.contentVersion, 1, `${description}内容版本`);
    return;
  }
  assert(identity.kind === "personal", `${description}类型无效。`);
  assertExactKeys(identity, ["kind", "personalTemplateId", "updatedAt"], [], description);
  assertNonEmptyString(identity.personalTemplateId, `${description}个人模板标识`);
  assertIsoDateTime(identity.updatedAt, `${description}更新时间`);
}

function validatePersonalTemplate(template, description) {
  assertExactKeys(
    template,
    ["personalTemplateId", "title", "groups", "createdAt", "updatedAt"],
    ["derivedFromTemplateId", "derivedFromContentVersion", "icon", "themeColor", "deletedAt"],
    description,
  );
  assertNonEmptyString(template.personalTemplateId, `${description}标识`);
  if (template.derivedFromTemplateId !== undefined) {
    assert(
      typeof template.derivedFromTemplateId === "string" &&
        template.derivedFromTemplateId.startsWith("official."),
      `${description}来源官方模板标识无效。`,
    );
  }
  if (template.derivedFromContentVersion !== undefined) {
    assertInteger(template.derivedFromContentVersion, 1, `${description}来源内容版本`);
  }
  assertOptionalNonEmptyString(template.icon, `${description}图标`);
  assertOptionalNonEmptyString(template.themeColor, `${description}主题色`);
  assertIsoDateTime(template.createdAt, `${description}创建时间`);
  assertIsoDateTime(template.updatedAt, `${description}更新时间`);
  assertOptionalIsoDateTime(template.deletedAt, `${description}删除时间`);
  validateTemplateSnapshot({ title: template.title, groups: template.groups }, `${description}内容`);
}

function validatePlannedCheck(plan, description) {
  assertExactKeys(
    plan,
    [
      "plannedCheckId",
      "status",
      "scheduledDate",
      "createdTimeZoneId",
      "sourceTemplateIdentity",
      "plannedTemplateSnapshot",
      "createdAt",
    ],
    ["scheduledTime", "startedCheckRunId"],
    description,
  );
  assertNonEmptyString(plan.plannedCheckId, `${description}标识`);
  assert(["pending", "consumed", "canceled"].includes(plan.status), `${description}状态无效。`);
  assert(
    typeof plan.scheduledDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(plan.scheduledDate),
    `${description}日期格式无效。`,
  );
  if (plan.scheduledTime !== undefined) {
    assert(
      typeof plan.scheduledTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(plan.scheduledTime),
      `${description}时间格式无效。`,
    );
  }
  assertNonEmptyString(plan.createdTimeZoneId, `${description}创建时区`);
  validateTemplateIdentity(plan.sourceTemplateIdentity, `${description}来源模板`);
  validateTemplateSnapshot(plan.plannedTemplateSnapshot, `${description}快照`);
  assertOptionalNonEmptyString(plan.startedCheckRunId, `${description}关联检查标识`);
  assertIsoDateTime(plan.createdAt, `${description}创建时间`);
}

function validateRunItem(item, description) {
  assertExactKeys(
    item,
    ["runItemId", "groupId", "title", "importance", "state", "runSortOrder", "isTemporary"],
    ["sourceItemId", "condition", "hint", "oneTimeNote"],
    description,
  );
  assertNonEmptyString(item.runItemId, `${description}标识`);
  assertOptionalNonEmptyString(item.sourceItemId, `${description}来源项目标识`);
  assertNonEmptyString(item.groupId, `${description}分组标识`);
  assertNonEmptyString(item.title, `${description}标题`);
  assert(["normal", "key"].includes(item.importance), `${description}重要性无效。`);
  assertOptionalNonEmptyString(item.condition, `${description}条件`);
  assertOptionalNonEmptyString(item.hint, `${description}提示`);
  assert(["unchecked", "confirmed", "notNeeded"].includes(item.state), `${description}状态无效。`);
  if (item.oneTimeNote !== undefined) {
    assert(
      typeof item.oneTimeNote === "string" && item.oneTimeNote.length <= 500,
      `${description}本次备注必须是不超过 500 字的文本。`,
    );
  }
  assertInteger(item.runSortOrder, 0, `${description}排序`);
  assert(typeof item.isTemporary === "boolean", `${description}临时标记无效。`);
}

function validateClosedEvent(event, description) {
  assertExactKeys(
    event,
    ["closedEventId", "type", "closedAt", "unresolvedCount", "unresolvedKeyCount"],
    [],
    description,
  );
  assertNonEmptyString(event.closedEventId, `${description}标识`);
  assert(["completed", "endedWithUnresolved", "discarded"].includes(event.type), `${description}类型无效。`);
  assertIsoDateTime(event.closedAt, `${description}关闭时间`);
  assertInteger(event.unresolvedCount, 0, `${description}未处理数量`);
  assertInteger(event.unresolvedKeyCount, 0, `${description}关键未处理数量`);
}

function validateRun(run, description) {
  assertExactKeys(
    run,
    [
      "checkRunId",
      "sourceTemplateIdentity",
      "runTemplateSnapshot",
      "status",
      "items",
      "startedAt",
      "lastInteractedAt",
      "closedEvents",
      "reopenCount",
    ],
    ["sourcePlannedCheckId", "lastReopenedAt", "deletedAt"],
    description,
  );
  assertNonEmptyString(run.checkRunId, `${description}标识`);
  validateTemplateIdentity(run.sourceTemplateIdentity, `${description}来源模板`);
  assertOptionalNonEmptyString(run.sourcePlannedCheckId, `${description}来源计划标识`);
  validateTemplateSnapshot(run.runTemplateSnapshot, `${description}快照`);
  assert(["inProgress", "completed", "endedWithUnresolved", "discarded"].includes(run.status), `${description}状态无效。`);
  assert(Array.isArray(run.items) && run.items.length > 0, `${description}缺少项目。`);
  run.items.forEach((item, index) => validateRunItem(item, `${description}项目 ${index + 1}`));
  assertIsoDateTime(run.startedAt, `${description}开始时间`);
  assertIsoDateTime(run.lastInteractedAt, `${description}最近交互时间`);
  assert(Array.isArray(run.closedEvents), `${description}关闭事件结构无效。`);
  run.closedEvents.forEach((event, index) => validateClosedEvent(event, `${description}关闭事件 ${index + 1}`));
  assertInteger(run.reopenCount, 0, `${description}重开次数`);
  assertOptionalIsoDateTime(run.lastReopenedAt, `${description}最近重开时间`);
  assertOptionalIsoDateTime(run.deletedAt, `${description}删除时间`);
}

function validateRunSnapshotItems(run) {
  const frozenItems = run.runTemplateSnapshot.groups.reduce(
    (entries, group) =>
      entries.concat(group.items.map((item) => ({ groupId: group.groupId, item }))),
    [],
  );
  const frozenById = new Map(
    frozenItems.map((entry) => [entry.item.itemId, entry]),
  );
  const sourcedItems = run.items.filter((item) => !item.isTemporary);

  assert(
    sourcedItems.length === frozenItems.length,
    `检查 ${run.checkRunId} 的运行项与冻结快照数量不一致。`,
  );

  run.items.forEach((runItem) => {
    if (runItem.isTemporary) {
      assert(
        runItem.sourceItemId === undefined,
        `检查 ${run.checkRunId} 的临时项不应声称冻结来源。`,
      );
      return;
    }

    const sourceItemId = runItem.sourceItemId;
    const frozen = sourceItemId ? frozenById.get(sourceItemId) : undefined;
    assert(
      sourceItemId &&
        frozen &&
        runItem.runItemId === `${run.checkRunId}:${sourceItemId}` &&
        runItem.groupId === frozen.groupId &&
        runItem.title === frozen.item.title &&
        runItem.importance === frozen.item.importance &&
        runItem.condition === frozen.item.condition &&
        runItem.hint === frozen.item.hint,
      `检查 ${run.checkRunId} 的运行项与冻结快照不一致。`,
    );
  });
}

function validateClosedRun(run) {
  if (run.status === "inProgress") return;
  const lastClose = run.closedEvents[run.closedEvents.length - 1];
  assert(lastClose && lastClose.type === run.status, `检查 ${run.checkRunId} 的关闭状态与关闭事件不一致。`);
  const unresolved = run.items.filter((item) => item.state === "unchecked");
  const unresolvedKey = unresolved.filter((item) => item.importance === "key");
  assert(
    lastClose.unresolvedCount === unresolved.length &&
      lastClose.unresolvedKeyCount === unresolvedKey.length,
    `检查 ${run.checkRunId} 的未处理计数与项目事实不一致。`,
  );
  assert(run.status !== "completed" || unresolved.length === 0, `检查 ${run.checkRunId} 仍有未处理项却标记为完成。`);
  assert(
    run.status !== "endedWithUnresolved" || unresolved.length > 0,
    `检查 ${run.checkRunId} 没有未处理项却标记为未解决结束。`,
  );
}

function validateSnapshot(candidate) {
  assertExactKeys(
    candidate,
    [
      "schemaVersion",
      "minimumWriterVersion",
      "appVersion",
      "officialContentVersion",
      "personalTemplates",
      "plannedChecks",
      "checkRuns",
      "settings",
      "updatedAt",
    ],
    ["lastBackupAt"],
    "应用数据",
  );
  assert(candidate.schemaVersion === SCHEMA_VERSION, "不支持的数据结构版本。");
  assert(candidate.minimumWriterVersion === 1, "当前写入版本不兼容。");
  assertNonEmptyString(candidate.appVersion, "应用版本");
  assert(candidate.officialContentVersion === OFFICIAL_CONTENT_VERSION, "不支持的官方内容版本。");
  assert(Array.isArray(candidate.personalTemplates), "个人模板结构无效。");
  assert(Array.isArray(candidate.plannedChecks), "计划结构无效。");
  assert(Array.isArray(candidate.checkRuns), "检查运行结构无效。");
  assertExactKeys(
    candidate.settings,
    ["favoriteTemplateIds", "hiddenOfficialTemplateIds", "backupNudgeDismissed"],
    [],
    "设置",
  );
  assert(Array.isArray(candidate.settings.favoriteTemplateIds), "收藏设置结构无效。");
  assert(Array.isArray(candidate.settings.hiddenOfficialTemplateIds), "隐藏设置结构无效。");
  candidate.settings.favoriteTemplateIds.forEach((id) => assertNonEmptyString(id, "收藏模板标识"));
  candidate.settings.hiddenOfficialTemplateIds.forEach((id) =>
    assert(typeof id === "string" && id.startsWith("official."), "隐藏官方模板标识无效。"),
  );
  assert(typeof candidate.settings.backupNudgeDismissed === "boolean", "备份提示设置结构无效。");
  assertOptionalIsoDateTime(candidate.lastBackupAt, "最近备份时间");
  assertIsoDateTime(candidate.updatedAt, "更新时间");

  assertUnique(candidate.personalTemplates.map((template) => template.personalTemplateId), "个人模板");
  assertUnique(candidate.plannedChecks.map((plan) => plan.plannedCheckId), "计划");
  assertUnique(candidate.checkRuns.map((run) => run.checkRunId), "检查运行");
  assertUnique(candidate.settings.favoriteTemplateIds, "收藏模板");
  assertUnique(candidate.settings.hiddenOfficialTemplateIds, "隐藏官方模板");

  candidate.personalTemplates.forEach((template, index) =>
    validatePersonalTemplate(template, `个人模板 ${index + 1}`),
  );
  candidate.plannedChecks.forEach((plan, index) => validatePlannedCheck(plan, `计划 ${index + 1}`));

  const plansById = new Map(candidate.plannedChecks.map((plan) => [plan.plannedCheckId, plan]));
  const runsById = new Map(candidate.checkRuns.map((run) => [run.checkRunId, run]));

  candidate.checkRuns.forEach((run) => {
    validateRun(run, `检查 ${run.checkRunId || "未知"}`);
    assertUnique(run.items.map((item) => item.runItemId), `检查 ${run.checkRunId} 的运行项目`);
    assertUnique(
      run.items.filter((item) => item.sourceItemId !== undefined).map((item) => item.sourceItemId),
      `检查 ${run.checkRunId} 的来源项目`,
    );
    validateRunSnapshotItems(run);
    assertUnique(run.items.map((item) => String(item.runSortOrder)), `检查 ${run.checkRunId} 的排序`);
    const orders = run.items.map((item) => item.runSortOrder).sort((left, right) => left - right);
    assert(orders.every((order, index) => order === index), `检查 ${run.checkRunId} 的排序不是连续序列。`);
    assertUnique(run.closedEvents.map((event) => event.closedEventId), `检查 ${run.checkRunId} 的关闭事件`);
    const expectedCloseCount = run.status === "inProgress" ? run.reopenCount : run.reopenCount + 1;
    const priorCloseEvents =
      run.status === "inProgress" ? run.closedEvents : run.closedEvents.slice(0, -1);
    const hasImpossibleCloseFact = run.closedEvents.some(
      (event) =>
        event.unresolvedKeyCount > event.unresolvedCount ||
        (event.type === "completed" && event.unresolvedCount !== 0) ||
        (event.type === "endedWithUnresolved" && event.unresolvedCount === 0),
    );
    assert(
      run.closedEvents.length === expectedCloseCount &&
        (run.lastReopenedAt !== undefined) === (run.reopenCount > 0) &&
        priorCloseEvents.every((event) => event.type !== "discarded") &&
        !hasImpossibleCloseFact,
      `检查 ${run.checkRunId} 的关闭与重开事件链不一致。`,
    );
    validateClosedRun(run);
    if (run.sourcePlannedCheckId) {
      const sourcePlan = plansById.get(run.sourcePlannedCheckId);
      assert(
        sourcePlan &&
          sourcePlan.startedCheckRunId === run.checkRunId &&
          factsMatch(sourcePlan.sourceTemplateIdentity, run.sourceTemplateIdentity) &&
          factsMatch(sourcePlan.plannedTemplateSnapshot, run.runTemplateSnapshot),
        `检查 ${run.checkRunId} 与来源计划的引用或冻结事实不一致。`,
      );
    }
  });

  candidate.plannedChecks.forEach((plan) => {
    if (plan.status === "consumed") {
      const run = plan.startedCheckRunId ? runsById.get(plan.startedCheckRunId) : undefined;
      assert(
        run && run.sourcePlannedCheckId === plan.plannedCheckId,
        `已消费计划 ${plan.plannedCheckId} 没有对应的检查运行。`,
      );
    } else {
      assert(plan.startedCheckRunId === undefined, `未消费计划 ${plan.plannedCheckId} 不应绑定检查运行。`);
    }
  });

  return clone(candidate);
}

function createInitialSnapshot(now) {
  return {
    schemaVersion: SCHEMA_VERSION,
    minimumWriterVersion: 1,
    appVersion: APP_VERSION,
    officialContentVersion: OFFICIAL_CONTENT_VERSION,
    personalTemplates: [],
    plannedChecks: [],
    checkRuns: [],
    settings: {
      favoriteTemplateIds: [],
      hiddenOfficialTemplateIds: [],
      backupNudgeDismissed: false,
    },
    updatedAt: now,
  };
}

function deterministicId(kind, now, identity) {
  const seed = `${kind}|${now}|${identity}`;
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return `${kind}.${Math.abs(hash >>> 0).toString(36)}`;
}

function templateIdentityFor(source) {
  if (Object.prototype.hasOwnProperty.call(source, "templateId")) {
    return {
      kind: "official",
      templateId: source.templateId,
      contentVersion: source.contentVersion,
    };
  }
  return {
    kind: "personal",
    personalTemplateId: source.personalTemplateId,
    updatedAt: source.updatedAt,
  };
}

function snapshotTemplate(source) {
  const snapshot = { title: source.title };
  if (Object.prototype.hasOwnProperty.call(source, "applicability")) {
    snapshot.applicability = source.applicability;
  }
  snapshot.groups = clone(source.groups);
  return snapshot;
}

function identityKey(identity) {
  return identity.kind === "official"
    ? `${identity.templateId}@${identity.contentVersion}`
    : `${identity.personalTemplateId}@${identity.updatedAt}`;
}

function startRunFromSnapshot(sourceTemplateIdentity, runTemplateSnapshot, now, options) {
  const resolvedOptions = options || {};
  const checkRunId =
    resolvedOptions.checkRunId !== undefined
      ? resolvedOptions.checkRunId
      : deterministicId("run", now, identityKey(sourceTemplateIdentity));
  const items = [];
  runTemplateSnapshot.groups.forEach((group) => {
    group.items.forEach((item) => items.push({ group, item }));
  });
  const run = {
    checkRunId,
    sourceTemplateIdentity: clone(sourceTemplateIdentity),
  };
  if (resolvedOptions.sourcePlannedCheckId) {
    run.sourcePlannedCheckId = resolvedOptions.sourcePlannedCheckId;
  }
  run.runTemplateSnapshot = clone(runTemplateSnapshot);
  run.status = "inProgress";
  run.items = items.map(({ group, item }, runSortOrder) => {
    const runItem = {
      runItemId: `${checkRunId}:${item.itemId}`,
      sourceItemId: item.itemId,
      groupId: group.groupId,
      title: item.title,
      importance: item.importance,
    };
    if (item.condition) runItem.condition = item.condition;
    if (item.hint) runItem.hint = item.hint;
    runItem.state = "unchecked";
    runItem.runSortOrder = runSortOrder;
    runItem.isTemporary = false;
    return runItem;
  });
  run.startedAt = now;
  run.lastInteractedAt = now;
  run.closedEvents = [];
  run.reopenCount = 0;
  return run;
}

function startRun(source, now, options) {
  return startRunFromSnapshot(templateIdentityFor(source), snapshotTemplate(source), now, options);
}

function assertInProgress(run) {
  assert(run.status === "inProgress", "只有进行中的检查可以修改。");
}

function matchesItem(item, itemId) {
  return item.runItemId === itemId || item.sourceItemId === itemId;
}

function updateItemState(run, itemId, state, now) {
  assertInProgress(run);
  let found = false;
  const items = run.items.map((item) => {
    if (!matchesItem(item, itemId)) return item;
    found = true;
    return Object.assign({}, item, { state });
  });
  assert(found, "找不到本次检查项。");
  return Object.assign({}, run, { items, lastInteractedAt: now });
}

function toggleConfirmed(run, itemId, now) {
  const item = run.items.find((candidate) => matchesItem(candidate, itemId));
  assert(item, "找不到本次检查项。");
  return updateItemState(run, itemId, item.state === "confirmed" ? "unchecked" : "confirmed", now);
}

function markNotNeeded(run, itemId, now) {
  const item = run.items.find((candidate) => matchesItem(candidate, itemId));
  assert(item, "找不到本次检查项。");
  return updateItemState(run, itemId, item.state === "notNeeded" ? "unchecked" : "notNeeded", now);
}

function reorderRunItems(run, orderedRunItemIds, now) {
  assertInProgress(run);
  const expected = new Set(run.items.map((item) => item.runItemId));
  const received = new Set(orderedRunItemIds);
  assert(
    received.size === orderedRunItemIds.length &&
      received.size === expected.size &&
      Array.from(expected).every((id) => received.has(id)),
    "排序必须且只能包含本次检查的全部项目。",
  );
  const byId = new Map(run.items.map((item) => [item.runItemId, item]));
  return Object.assign({}, run, {
    items: orderedRunItemIds.map((runItemId, runSortOrder) =>
      Object.assign({}, byId.get(runItemId), { runSortOrder }),
    ),
    lastInteractedAt: now,
  });
}

function filterRunItems(run, view) {
  const ordered = run.items.slice().sort((left, right) => left.runSortOrder - right.runSortOrder);
  return view === "key" ? ordered.filter((item) => item.importance === "key") : ordered;
}

function addTemporaryItem(run, input, now, options) {
  assertInProgress(run);
  const title = input.title.trim();
  const runItemId =
    options && options.runItemId !== undefined
      ? options.runItemId
      : deterministicId("temporary", now, `${run.checkRunId}:${title}`);
  const item = {
    runItemId,
    groupId: input.groupId !== undefined ? input.groupId : "temporary",
    title,
    importance: input.importance !== undefined ? input.importance : "normal",
  };
  if (input.condition) item.condition = input.condition;
  if (input.hint) item.hint = input.hint;
  if (input.oneTimeNote) item.oneTimeNote = input.oneTimeNote;
  item.state = "unchecked";
  item.runSortOrder = run.items.length;
  item.isTemporary = true;
  return Object.assign({}, run, {
    items: run.items.concat([item]),
    lastInteractedAt: now,
  });
}

function setOneTimeNote(run, itemId, oneTimeNote, now) {
  assertInProgress(run);
  let found = false;
  const items = run.items.map((item) => {
    if (!matchesItem(item, itemId)) return item;
    found = true;
    const next = Object.assign({}, item);
    delete next.oneTimeNote;
    if (oneTimeNote) next.oneTimeNote = oneTimeNote;
    return next;
  });
  assert(found, "找不到本次检查项。");
  return Object.assign({}, run, { items, lastInteractedAt: now });
}

function unresolvedCounts(run) {
  const unresolved = run.items.filter((item) => item.state === "unchecked");
  return {
    unresolvedCount: unresolved.length,
    unresolvedKeyCount: unresolved.filter((item) => item.importance === "key").length,
  };
}

function buildRunClosureReceipt(run) {
  if (run.status === "inProgress") return undefined;
  const lastClose = run.closedEvents[run.closedEvents.length - 1];
  if (!lastClose || lastClose.type !== run.status) return undefined;

  if (run.status === "completed") {
    return {
      kind: "completed",
      title: "这份清单已全部处理",
      message: "可以放心出发。",
    };
  }
  if (run.status === "endedWithUnresolved") {
    return {
      kind: "endedWithUnresolved",
      title: "本次检查已结束",
      message: `仍有${lastClose.unresolvedCount}项未确认，其中${lastClose.unresolvedKeyCount}项为关键项。`,
    };
  }
  return {
    kind: "discarded",
    title: "本次检查已放弃",
    message: "已如实保留“已放弃”事实，不会计作完成。",
  };
}

function closeAs(run, type, now, closedEventId) {
  const counts = unresolvedCounts(run);
  const event = Object.assign(
    {
      closedEventId:
        closedEventId !== undefined
          ? closedEventId
          : `${run.checkRunId}:closed:${run.closedEvents.length + 1}`,
      type,
      closedAt: now,
    },
    counts,
  );
  return Object.assign({}, run, {
    status: type,
    lastInteractedAt: now,
    closedEvents: run.closedEvents.concat([event]),
  });
}

function closeRun(run, options) {
  const counts = unresolvedCounts(run);
  if (run.status !== "inProgress") {
    return Object.assign({ kind: "rejected", reason: "runNotInProgress" }, counts);
  }
  if (options.intent === "discard") {
    return { kind: "discarded", run: closeAs(run, "discarded", options.now, options.closedEventId) };
  }
  if (options.intent === "complete" && counts.unresolvedCount > 0) {
    return Object.assign({ kind: "rejected", reason: "uncheckedItemsRemain" }, counts);
  }
  if (counts.unresolvedCount === 0) {
    return { kind: "completed", run: closeAs(run, "completed", options.now, options.closedEventId) };
  }
  if (counts.unresolvedKeyCount > 0 && options.keyRiskConfirmed !== true) {
    return Object.assign({ kind: "needsKeyConfirmation" }, counts);
  }
  return {
    kind: "endedWithUnresolved",
    run: closeAs(run, "endedWithUnresolved", options.now, options.closedEventId),
  };
}

function reopenRun(run, now) {
  if (run.status !== "completed" && run.status !== "endedWithUnresolved") {
    return { kind: "unavailable", reason: "statusNotReopenable" };
  }
  const previousClose = run.closedEvents[run.closedEvents.length - 1];
  if (!previousClose) return { kind: "unavailable", reason: "missingCloseEvent" };
  if (Date.parse(now) - Date.parse(previousClose.closedAt) > REOPEN_WINDOW_HOURS * 60 * 60 * 1000) {
    return { kind: "unavailable", reason: "windowExpired" };
  }
  return {
    kind: "reopened",
    run: Object.assign({}, run, {
      status: "inProgress",
      reopenCount: run.reopenCount + 1,
      lastReopenedAt: now,
      lastInteractedAt: now,
      closedEvents: run.closedEvents.slice(),
    }),
  };
}

function restartFromHistory(historyRun, now, options) {
  return startRunFromSnapshot(
    historyRun.sourceTemplateIdentity,
    historyRun.runTemplateSnapshot,
    now,
    options || {},
  );
}

function isStaleCandidate(run, now) {
  return (
    run.status === "inProgress" &&
    Date.parse(now) - Date.parse(run.lastInteractedAt) >= STALE_AFTER_HOURS * 60 * 60 * 1000
  );
}

function createPlannedCheck(source, options) {
  const plan = {
    plannedCheckId: options.plannedCheckId,
    status: "pending",
    scheduledDate: options.scheduledDate,
  };
  if (options.scheduledTime) plan.scheduledTime = options.scheduledTime;
  plan.createdTimeZoneId = options.createdTimeZoneId;
  plan.sourceTemplateIdentity = templateIdentityFor(source);
  plan.plannedTemplateSnapshot = snapshotTemplate(source);
  plan.createdAt = options.now;
  return plan;
}

function startPlannedCheck(plan, now, options) {
  assert(plan.status === "pending", "只有待处理计划可以开始检查。");
  const run = startRunFromSnapshot(
    plan.sourceTemplateIdentity,
    plan.plannedTemplateSnapshot,
    now,
    Object.assign({}, options || {}, { sourcePlannedCheckId: plan.plannedCheckId }),
  );
  return {
    plan: Object.assign({}, plan, { status: "consumed", startedCheckRunId: run.checkRunId }),
    run,
  };
}

function cancelPlannedCheck(plan) {
  return plan.status === "pending" ? Object.assign({}, plan, { status: "canceled" }) : clone(plan);
}

function rankUpcomingPlans(plans) {
  function sortKey(plan) {
    return `${plan.scheduledDate}T${plan.scheduledTime !== undefined ? plan.scheduledTime : "24:00"}`;
  }
  return plans
    .filter((plan) => plan.status === "pending")
    .map((plan) => clone(plan))
    .sort(
      (left, right) =>
        sortKey(left).localeCompare(sortKey(right)) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.plannedCheckId.localeCompare(right.plannedCheckId),
    );
}

function dueOrNearPlanSortValue(plan, now) {
  if (plan.status === "canceled") return undefined;
  function wallTimeMilliseconds(date, time) {
    const dateParts = date.split("-").map(Number);
    const timeParts = time.split(":").map(Number);
    return Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);
  }
  const current = wallTimeMilliseconds(now.localDate, now.localTime);
  const scheduled = wallTimeMilliseconds(plan.scheduledDate, plan.scheduledTime || "23:59");
  return scheduled - current <= 24 * 60 * 60 * 1000 ? scheduled : undefined;
}

function rankContinueRuns(runs, plans, now) {
  const planById = new Map(plans.map((plan) => [plan.plannedCheckId, plan]));
  function urgency(run) {
    if (!run.sourcePlannedCheckId) return undefined;
    const plan = planById.get(run.sourcePlannedCheckId);
    return plan ? dueOrNearPlanSortValue(plan, now) : undefined;
  }
  return runs
    .filter((run) => run.status === "inProgress")
    .map((run) => clone(run))
    .sort((left, right) => {
      const leftUrgency = urgency(left);
      const rightUrgency = urgency(right);
      const leftPrioritized = leftUrgency !== undefined;
      const rightPrioritized = rightUrgency !== undefined;
      if (leftPrioritized !== rightPrioritized) return leftPrioritized ? -1 : 1;
      if (leftUrgency !== undefined && rightUrgency !== undefined && leftUrgency !== rightUrgency) {
        return leftUrgency - rightUrgency;
      }
      return (
        right.lastInteractedAt.localeCompare(left.lastInteractedAt) ||
        right.startedAt.localeCompare(left.startedAt) ||
        left.checkRunId.localeCompare(right.checkRunId)
      );
    });
}

function includesQuery(value, query) {
  return typeof value === "string" && value.toLocaleLowerCase("zh-CN").includes(query);
}

function searchTemplates(templates, rawQuery) {
  const query = String(rawQuery || "").trim().toLocaleLowerCase("zh-CN");
  if (!query) return [];
  return templates
    .map((template) => {
      const matches = [];
      if (includesQuery(template.title, query)) matches.push("title");
      if (template.searchAliases.some((alias) => includesQuery(alias, query))) matches.push("aliases");
      const items = template.groups.reduce((all, group) => all.concat(group.items), []);
      if (items.some((item) => includesQuery(item.title, query))) matches.push("itemTitle");
      if (includesQuery(template.applicability, query)) matches.push("applicability");
      if (items.some((item) => includesQuery(item.hint, query))) matches.push("hint");
      if (matches.length === 0) return undefined;
      return {
        template: clone(template),
        score: Math.max.apply(null, matches.map((field) => SEARCH_WEIGHTS[field])),
        matches,
      };
    })
    .filter((result) => result !== undefined)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.template.featuredOrder === null ? Number.POSITIVE_INFINITY : left.template.featuredOrder) -
          (right.template.featuredOrder === null ? Number.POSITIVE_INFINITY : right.template.featuredOrder) ||
        left.template.title.localeCompare(right.template.title, "zh-CN") ||
        left.template.templateId.localeCompare(right.template.templateId),
    );
}

function derivePersonalTemplate(official, edits, now, options) {
  const template = {
    personalTemplateId: options.personalTemplateId,
    derivedFromTemplateId: official.templateId,
    derivedFromContentVersion: official.contentVersion,
    title: edits.title !== undefined ? edits.title : official.title,
    groups: clone(edits.groups !== undefined ? edits.groups : official.groups),
  };
  if (edits.icon) template.icon = edits.icon;
  if (edits.themeColor) template.themeColor = edits.themeColor;
  template.createdAt = now;
  template.updatedAt = now;
  return template;
}

function softDeletePersonalTemplate(template, now) {
  return Object.assign({}, template, { deletedAt: now, updatedAt: now });
}

function restorePersonalTemplate(template, now) {
  const restored = Object.assign({}, template, { updatedAt: now });
  delete restored.deletedAt;
  return restored;
}

function prepareReset(current, now) {
  return {
    protectiveCopyLabel: "before-reset",
    sourceUpdatedAt: current.updatedAt,
    next: {
      schemaVersion: current.schemaVersion,
      minimumWriterVersion: current.minimumWriterVersion,
      appVersion: current.appVersion,
      officialContentVersion: current.officialContentVersion,
      personalTemplates: [],
      plannedChecks: [],
      checkRuns: [],
      settings: {
        favoriteTemplateIds: [],
        hiddenOfficialTemplateIds: [],
        backupNudgeDismissed: false,
      },
      updatedAt: now,
    },
  };
}

function exportBackup(snapshot, sourcePlatform, exportedAt) {
  assert(sourcePlatform === "pwa" || sourcePlatform === "wechat", "备份来源平台无效。");
  assertIsoDateTime(exportedAt, "备份导出时间");
  const data = validateSnapshot(snapshot);
  return {
    productId: "biewangle",
    appVersion: data.appVersion,
    schemaVersion: SCHEMA_VERSION,
    backupFormatVersion: 1,
    sourcePlatform,
    officialContentVersion: data.officialContentVersion,
    exportedAt,
    data,
  };
}

function parseAndValidateBackup(raw) {
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (_error) {
    throw new Error("备份文件不是有效 JSON。");
  }
  assert(isRecord(envelope), "备份文件缺少有效的外层结构。");
  assertExactKeys(
    envelope,
    [
      "productId",
      "appVersion",
      "schemaVersion",
      "backupFormatVersion",
      "sourcePlatform",
      "officialContentVersion",
      "exportedAt",
      "data",
    ],
    [],
    "备份文件",
  );
  assert(envelope.productId === "biewangle", "该文件不是“别忘了”备份。");
  assertNonEmptyString(envelope.appVersion, "备份应用版本");
  assert(envelope.backupFormatVersion === 1, "不支持的备份格式版本。");
  assert(envelope.schemaVersion === SCHEMA_VERSION, "不支持的数据结构版本。");
  assert(envelope.sourcePlatform === "pwa" || envelope.sourcePlatform === "wechat", "备份来源平台无效。");
  assert(envelope.officialContentVersion === OFFICIAL_CONTENT_VERSION, "不支持的官方内容版本。");
  assertIsoDateTime(envelope.exportedAt, "备份导出时间");
  const data = validateSnapshot(envelope.data);
  assert(data.appVersion === envelope.appVersion, "备份头部版本与数据内容不一致。");
  assert(data.officialContentVersion === envelope.officialContentVersion, "备份头部版本与数据内容不一致。");
  return clone(Object.assign({}, envelope, { data }));
}

function readableStatusLabel(status) {
  if (status === "completed") return "已完成";
  if (status === "endedWithUnresolved") return "有未确认项结束";
  if (status === "discarded") return "已放弃";
  return "进行中";
}

function buildReadableExport(snapshot) {
  const lines = [
    "# 别忘了 · 人类可读导出",
    "",
    `导出数据更新时间：${snapshot.updatedAt}`,
    "",
    "## 个人模板",
  ];
  const activeTemplates = snapshot.personalTemplates.filter((template) => !template.deletedAt);
  if (activeTemplates.length === 0) lines.push("- 无");
  activeTemplates.forEach((template) => {
    lines.push("", `### ${template.title}`);
    template.groups.forEach((group) => {
      lines.push(`- ${group.title}`);
      group.items.forEach((item) => lines.push(`  - ${item.title}`));
    });
  });

  lines.push("", "## 待处理计划");
  const plans = snapshot.plannedChecks.filter((plan) => plan.status === "pending");
  if (plans.length === 0) lines.push("- 无");
  plans.forEach((plan) => {
    lines.push(
      `- ${plan.scheduledDate}${plan.scheduledTime ? ` ${plan.scheduledTime}` : " 全天"} · ${plan.plannedTemplateSnapshot.title}`,
    );
  });

  lines.push("", "## 检查历史摘要");
  const history = snapshot.checkRuns.filter((run) => run.status !== "inProgress");
  if (history.length === 0) lines.push("- 无");
  history.forEach((run) => {
    lines.push(
      `- ${run.lastInteractedAt} · ${run.runTemplateSnapshot.title} · ${readableStatusLabel(run.status)}`,
    );
  });
  lines.push("", "本文件便于阅读，不包含本次私密备注，也不用于完整恢复；恢复请使用 JSON 完整备份。");
  return lines.join("\n");
}

function buildRunShareText(run) {
  const counts = unresolvedCounts(run);
  const lines = [
    `别忘了｜${run.runTemplateSnapshot.title}`,
    `状态：${run.status}`,
    `未确认：${counts.unresolvedCount} 项（关键 ${counts.unresolvedKeyCount} 项）`,
    "",
  ];
  run.items
    .slice()
    .sort((left, right) => left.runSortOrder - right.runSortOrder)
    .forEach((item) => {
      const marker = item.state === "confirmed" ? "✓" : item.state === "notNeeded" ? "—" : "○";
      lines.push(`${marker} ${item.title}${item.isTemporary ? "（临时）" : ""}`);
    });
  lines.push("", "隐私提示：本次备注默认不包含在分享中。");
  return lines.join("\n");
}

module.exports = {
  APP_VERSION,
  OFFICIAL_CONTENT_VERSION,
  SCHEMA_VERSION,
  addTemporaryItem,
  buildRunClosureReceipt,
  buildReadableExport,
  buildRunShareText,
  cancelPlannedCheck,
  clone,
  closeRun,
  createInitialSnapshot,
  createPlannedCheck,
  derivePersonalTemplate,
  exportBackup,
  filterRunItems,
  isStaleCandidate,
  markNotNeeded,
  parseAndValidateBackup,
  prepareReset,
  rankContinueRuns,
  rankUpcomingPlans,
  reorderRunItems,
  reopenRun,
  restartFromHistory,
  restorePersonalTemplate,
  searchTemplates,
  setOneTimeNote,
  snapshotTemplate,
  softDeletePersonalTemplate,
  startPlannedCheck,
  startRun,
  startRunFromSnapshot,
  templateIdentityFor,
  toggleConfirmed,
  unresolvedCounts,
  validateSnapshot,
};
