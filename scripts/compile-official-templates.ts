import {
  OfficialContentBundleSchema,
  type Importance,
  type OfficialContentBundle,
  type OfficialTemplate,
  type OfficialTemplateGroup,
  type OfficialTemplateItem,
} from "../packages/domain/src/schema";

interface TemplateDraft {
  title: string;
  metadata: Map<string, string>;
  groups: OfficialTemplateGroup[];
}

const TEMPLATE_HEADER = /^### \d+、(.+)$/;
const GROUP_HEADER = /^#### (.+?)\s+`([^`]+)`\s*$/;
const METADATA_LINE = /^- \*\*(.+?)：\*\*\s*(.*)$/;

function requireMetadata(draft: TemplateDraft, key: string): string {
  const value = draft.metadata.get(key);
  if (!value) {
    throw new Error(`模板“${draft.title}”缺少元数据：${key}`);
  }
  return value;
}

function parseDuration(value: string): [number, number] {
  const match = /^(\d+)—(\d+)秒$/.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new Error(`无法解析设计目标时长：${value}`);
  }
  return [Number(match[1]), Number(match[2])];
}

function parseAliases(value: string): string[] {
  const aliases = [...value.matchAll(/`([^`]+)`/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
  if (aliases.length === 0) {
    throw new Error(`无法解析 searchAliases：${value}`);
  }
  return aliases;
}

function parseItemRow(line: string): OfficialTemplateItem | null {
  if (!line.startsWith("| `")) {
    return null;
  }

  const cells = line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (cells.length !== 5) {
    throw new Error(`官方模板表格列数错误：${line}`);
  }

  const [rawItemId, rawImportance, title, rawCondition, rawHint] = cells;
  const itemIdMatch = rawItemId?.match(/^`([^`]+)`$/);
  if (
    !itemIdMatch?.[1] ||
    (rawImportance !== "key" && rawImportance !== "normal") ||
    !title ||
    rawCondition === undefined ||
    rawHint === undefined
  ) {
    throw new Error(`官方模板项目格式错误：${line}`);
  }

  const item: OfficialTemplateItem = {
    itemId: itemIdMatch[1],
    importance: rawImportance as Importance,
    title,
  };
  if (rawCondition !== "—") {
    item.condition = rawCondition;
  }
  if (rawHint !== "—") {
    item.hint = rawHint;
  }
  return item;
}

function finishTemplate(draft: TemplateDraft): OfficialTemplate {
  const featuredValue = requireMetadata(draft, "featuredOrder");
  const template: OfficialTemplate = {
    templateId: requireMetadata(draft, "templateId").replaceAll("`", ""),
    contentVersion: Number(
      requireMetadata(draft, "contentVersion").replaceAll("`", ""),
    ),
    title: draft.title,
    applicability: requireMetadata(draft, "适用说明"),
    targetDurationSec: parseDuration(
      requireMetadata(draft, "设计目标时长"),
    ),
    searchAliases: parseAliases(requireMetadata(draft, "searchAliases")),
    featuredOrder: featuredValue === "—" ? null : Number(featuredValue),
    editorialIntent: requireMetadata(
      draft,
      "编辑意图（内部，不展示给用户）",
    ),
    groups: draft.groups,
  };
  const userTip = draft.metadata.get("用户短提示");
  if (userTip) {
    template.userTip = userTip;
  }
  return template;
}

export function compileOfficialTemplates(
  markdown: string,
): OfficialContentBundle {
  const templates: OfficialTemplate[] = [];
  let draft: TemplateDraft | undefined;
  let currentGroup: OfficialTemplateGroup | undefined;
  let insideTemplateSection = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (line === "## 四、13张正式模板") {
      insideTemplateSection = true;
      continue;
    }
    if (line === "## 五、内容治理与发布前检查") {
      break;
    }
    if (!insideTemplateSection) {
      continue;
    }

    const templateMatch = TEMPLATE_HEADER.exec(line);
    if (templateMatch?.[1]) {
      if (draft) {
        templates.push(finishTemplate(draft));
      }
      draft = {
        title: templateMatch[1],
        metadata: new Map(),
        groups: [],
      };
      currentGroup = undefined;
      continue;
    }
    if (!draft) {
      continue;
    }

    const metadataMatch = METADATA_LINE.exec(line);
    if (metadataMatch?.[1] && metadataMatch[2] !== undefined) {
      draft.metadata.set(metadataMatch[1], metadataMatch[2]);
      continue;
    }

    const groupMatch = GROUP_HEADER.exec(line);
    if (groupMatch?.[1] && groupMatch[2]) {
      currentGroup = {
        groupId: groupMatch[2],
        title: groupMatch[1].trim(),
        items: [],
      };
      draft.groups.push(currentGroup);
      continue;
    }

    const item = parseItemRow(line);
    if (item) {
      if (!currentGroup) {
        throw new Error(`项目 ${item.itemId} 出现在分组之前`);
      }
      currentGroup.items.push(item);
    }
  }

  if (draft) {
    templates.push(finishTemplate(draft));
  }

  return OfficialContentBundleSchema.parse({
    productId: "biewangle",
    officialContentVersion: 1,
    derived: true,
    source: "docs/02_别忘了_官方模板内容库_V1.1.md",
    templates,
  });
}
