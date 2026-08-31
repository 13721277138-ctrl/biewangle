function stateLabel(state) {
  if (state === "confirmed") return "已确认";
  if (state === "notNeeded") return "本次不需要";
  return "未确认";
}

function buildGroups(visibleItems) {
  const groups = [];
  for (const item of visibleItems) {
    let group = groups[groups.length - 1];
    if (!group || group.groupId !== item.groupId) {
      group = {
        groupId: item.groupId,
        handledCount: 0,
        itemCount: 0,
        items: [],
        renderKey: `${item.groupId}:${groups.length}`,
        title: item.groupTitle,
      };
      groups.push(group);
    }
    group.items.push(item);
    group.itemCount += 1;
    if (item.state !== "unchecked") group.handledCount += 1;
  }
  return groups;
}

function projectRunView(run, viewMode) {
  const titleByGroup = new Map(
    run.runTemplateSnapshot.groups.map((group) => [group.groupId, group.title]),
  );
  const allItems = run.items
    .slice()
    .sort((left, right) => left.runSortOrder - right.runSortOrder)
    .map((item, index, source) => ({
      ...item,
      groupTitle: titleByGroup.get(item.groupId) || "本次临时项",
      isConfirmed: item.state === "confirmed",
      isFirst: index === 0,
      isKey: item.importance === "key",
      isLast: index === source.length - 1,
      isNotNeeded: item.state === "notNeeded",
      stateLabel: stateLabel(item.state),
    }));
  const visibleItems = viewMode === "key"
    ? allItems.filter((item) => item.isKey)
    : allItems;
  const unresolved = allItems.filter((item) => item.state === "unchecked");

  return {
    allItems,
    groups: buildGroups(visibleItems),
    keyCount: allItems.filter((item) => item.isKey).length,
    unresolvedCount: unresolved.length,
    unresolvedKeyCount: unresolved.filter((item) => item.isKey).length,
    visibleItems,
  };
}

module.exports = {
  projectRunView,
};
