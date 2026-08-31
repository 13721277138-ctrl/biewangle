# 别忘了 V1.1 微信端视觉恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变任何冻结产品事实的前提下，把 11 个微信原生页面恢复为轻、干净、紧凑的原生工具体验，消除字体与按钮基线漂移，并让 390 × 844 的普通 Run 同时看到 Header、视图开关和至少四个完整项目标题。

**Architecture:** 保持 `packages/domain/`、`contracts/`、官方内容与 durable service 完全不变；新增一个只读的微信 Run 展示投影模块，把既有 Run 快照投影成有序分组和可见项目。WXML/WXSS 继续由微信原生页面独立实现；静态发布门新增视觉合同检查，页面级展开状态只留在内存中。

**Tech Stack:** Node.js 24.x、pnpm 11.19.0、Vitest 4、微信原生 JavaScript/WXML/WXSS、微信开发者工具。

**Spec:** `docs/superpowers/specs/2026-08-31-wechat-visual-restoration-design.md`

## Global Constraints

- Node.js 使用 24.x，pnpm 固定为 11.19.0；安装命令为 `pnpm install --frozen-lockfile`。
- 官方模板正文和身份以 `docs/02_别忘了_官方模板内容库_V1.1.md` 为唯一主源，不改 Markdown、派生 JSON 或 `miniprogram/generated/official-templates.js`。
- `packages/domain/`、`contracts/`、store/service 持久化协议、PWA UI 均不修改。
- CheckRun 核心状态继续只有 `inProgress | completed | endedWithUnresolved | discarded`；三状态继续只有 `unchecked | confirmed | notNeeded`。
- Planned Snapshot、Run Snapshot、关闭/重开事实、首页排序、分享隐私和 durable write 成功后再更新 UI 的顺序不得变化。
- 页面级 `expandedItemId`、`showTemporaryEditor` 等展开状态不进入 AppSnapshot，不参与备份、分享或完成计算。
- 字体只使用系统字体栈和 400、500、600、700 四档字重；不新增远程字体、运行时 CDN、账号、云同步、AI、Analytics 或广告。
- 点击目标不小于 88rpx × 88rpx；动态文字允许换行，375px 与 390px 宽度均不得横向溢出。
- 视觉状态必须保留可读文字，不能只用颜色表达关键、未确认、已确认、本次不需要、隐藏、过期或关闭类型。
- 微信官方编译、预览、上传、体验版与真机证据只记录实际执行结果；模拟器结果不得写成正式发布。

---

### Task 1: 把字体和按钮基础写入静态发布合同

**Files:**

- Modify: `scripts/verify-miniprogram.mjs`
- Modify: `tests/miniprogram/project-verifier.test.ts`
- Modify: `miniprogram/app.wxss`
- Modify: `miniprogram/pages/home/home.wxss`
- Modify: `miniprogram/pages/run/run.wxss`
- Modify: `miniprogram/pages/plans/plans.wxss`
- Modify: `miniprogram/pages/history/history.wxss`
- Modify: `miniprogram/pages/history-detail/history-detail.wxss`
- Modify: `miniprogram/pages/template-detail/template-detail.wxss`
- Modify: `miniprogram/pages/data/data.wxss`

**Interfaces:**

- Consumes: every runtime `.wxss` file found by `verifyMiniprogram(root)`.
- Produces: verifier issue code `nonstandard-font-weight` for numeric weights outside 400/500/600/700.
- Produces: verifier issue code `button-foundation` when the root `button` rule lacks flex centering, explicit line height, or the 88rpx minimum height.

- [ ] **Step 1: Write the failing verifier test**

Add a temporary native project fixture whose `app.wxss` contains `button { min-height: 70rpx; font-weight: 650; }`, execute the real verifier, and assert literal issue codes:

```ts
const result = verifyMiniprogram(root, { expectedRoutes: ["pages/unsafe/unsafe"] });
expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
  "nonstandard-font-weight",
  "button-foundation",
]));
```

The production break caught by this test is reintroducing an unstable numeric font weight or removing the shared centered-button content box.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/miniprogram/project-verifier.test.ts`

Expected: FAIL because the verifier does not yet emit either visual issue code.

- [ ] **Step 3: Implement the minimal verifier rules**

Add a `.wxss` scanner and root button check:

```js
const STANDARD_FONT_WEIGHTS = new Set([400, 500, 600, 700]);

function scanVisualFile(content, displayPath, issues) {
  for (const match of content.matchAll(/font-weight\s*:\s*(\d{3})\s*;/gu)) {
    const weight = Number(match[1]);
    if (!STANDARD_FONT_WEIGHTS.has(weight)) {
      issues.push(issue(
        "nonstandard-font-weight",
        displayPath,
        `font-weight ${weight} is outside 400/500/600/700`,
      ));
    }
  }
}
```

For `miniprogram/app.wxss`, inspect the actual `button { ... }` declaration and require `display: flex`, `align-items: center`, `justify-content: center`, `min-height: 88rpx`, and explicit `line-height`.

- [ ] **Step 4: Re-run and observe the intended project-level failure**

Run: `pnpm vitest run tests/miniprogram/project-verifier.test.ts`

Expected: the temporary fixture assertion passes, while the real-project acceptance case fails on existing weights such as 650/680/720/730/760/780 and the old button foundation.

- [ ] **Step 5: Replace the shared foundation and every nonstandard weight**

Set the root page and component primitives to the approved design values:

```css
page {
  min-height: 100%;
  background: #f7f7f3;
  color: #17201e;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 26rpx;
  font-weight: 400;
}

button {
  display: flex;
  box-sizing: border-box;
  min-height: 88rpx;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
  border-radius: 20rpx;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.2;
}
```

Define shared open-list primitives `.list-surface`, `.list-row`, `.list-row:last-child`, `.row-title`, `.row-meta`, `.text-button`, `.bottom-dock`, and `.page-with-dock`. Keep all shadows off ordinary rows and use only the approved colors in the design specification.

- [ ] **Step 6: Verify GREEN and commit**

Run: `pnpm vitest run tests/miniprogram/project-verifier.test.ts`

Run: `pnpm miniprogram:verify`

Expected: verifier tests pass; the real project reports 11 pages, 13 official templates, no visual contract issue, and a package below 2 MB.

Commit: `test(wechat): enforce visual foundation`

### Task 2: 用纯展示投影建立 Run 分组与密度合同

**Files:**

- Create: `miniprogram/lib/run-view.js`
- Create: `tests/miniprogram/run-view.test.ts`
- Modify: `miniprogram/pages/run/run.js`
- Modify: `tests/miniprogram/run-receipt-page.test.ts`

**Interfaces:**

- Consumes: frozen `CheckRun` and `viewMode: "all" | "key"`.
- Produces: `projectRunView(run, viewMode)` returning `{ allItems, visibleItems, groups, keyCount, unresolvedCount, unresolvedKeyCount }`.
- Each group is `{ renderKey, groupId, title, handledCount, itemCount, items }`; each item retains its original `runItemId`, `runSortOrder`, state, importance, title, condition, hint, note and temporary flag.
- `expandedItemId` and `showTemporaryEditor` stay on the Page instance only and never call a service command.

- [ ] **Step 1: Write the failing projection tests**

Use the real generated `official.daily_out` template and native domain start function:

```ts
const run = native.startRun(dailyOut, NOW, { checkRunId: "run.visual-projection" });
const all = projectRunView(run, "all");
expect(all.groups.map((group) => [group.title, group.itemCount])).toEqual([
  ["随身核心", 5],
  ["当天需要", 7],
]);
expect(all.visibleItems.map((item) => item.runItemId)).toEqual(
  run.items.slice().sort((a, b) => a.runSortOrder - b.runSortOrder).map((item) => item.runItemId),
);
expect(all.unresolvedCount).toBe(12);
expect(all.unresolvedKeyCount).toBe(2);

const key = projectRunView(run, "key");
expect(key.visibleItems.map((item) => item.sourceItemId)).toEqual(["daily.phone", "daily.keys"]);
expect(key.unresolvedCount).toBe(12);
```

The production breaks caught are reordering run identities during grouping or allowing the key-only filter to change completion facts.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/miniprogram/run-view.test.ts`

Expected: FAIL because `miniprogram/lib/run-view.js` does not exist.

- [ ] **Step 3: Implement the minimal pure projection**

Sort a cloned item array by `runSortOrder`, decorate presentation-only fields, filter only the visible array, and build contiguous display groups without mutating `run`:

```js
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
  return buildProjection(allItems, visibleItems);
}
```

`buildProjection` starts a new display group only when the sorted visible sequence changes `groupId`; a global reorder therefore remains byte-faithful even if a group label appears again later.

- [ ] **Step 4: Verify projection GREEN**

Run: `pnpm vitest run tests/miniprogram/run-view.test.ts`

Expected: PASS with literal group sizes, original run item order and filter-independent unresolved counts.

- [ ] **Step 5: Write failing page-state tests**

Instantiate the real Run Page and assert that presentation disclosures are reversible and service-free:

```ts
page.toggleItemTools({ currentTarget: { dataset: { itemId: "daily.phone" } } });
expect(page.data.expandedItemId).toBe("daily.phone");
page.toggleItemTools({ currentTarget: { dataset: { itemId: "daily.phone" } } });
expect(page.data.expandedItemId).toBe("");
page.toggleTemporaryEditor();
expect(page.data.showTemporaryEditor).toBe(true);
expect(service.getRun).not.toHaveBeenCalled();
```

- [ ] **Step 6: Verify page RED, then wire only presentation state**

Run: `pnpm vitest run tests/miniprogram/run-receipt-page.test.ts`

Expected before implementation: FAIL because the two handlers and fields do not exist.

Use `projectRunView` in `refresh()` and `changeView()`. Keep `this.allItems` for `reorderRunItems`, keep `run.items` for compatibility, add `run.groups` for WXML, and make note lookup use `this.allItems` rather than the current filter.

- [ ] **Step 7: Verify GREEN and commit**

Run: `pnpm vitest run tests/miniprogram/run-view.test.ts tests/miniprogram/run-receipt-page.test.ts tests/miniprogram/vertical-slice.test.ts tests/conformance/miniprogram-contract.test.ts`

Commit: `refactor(wechat): project dense run groups`

### Task 3: 重建 Run 的紧凑原生交互层

**Files:**

- Modify: `miniprogram/pages/run/run.wxml`
- Modify: `miniprogram/pages/run/run.wxss`
- Modify: `miniprogram/pages/run/run.js`
- Modify: `tests/miniprogram/run-receipt-page.test.ts`

**Interfaces:**

- Consumes: `run.groups`, `expandedItemId`, `showTemporaryEditor`, existing durable Page handlers and closure receipt.
- Produces: compact grouped rows, always-visible `确认 / 本次不需要`, disclosure-only sorting/note controls, conditional temporary editor, and safe-area bottom dock.
- Existing handlers `toggleConfirmed`, `markNotNeeded`, `moveItem`, `saveNote`, `addTemporaryItem`, `finishRun`, `discardRun`, `copySummary`, `openHistoryFact`, `goHome` retain their service calls and copy.

- [ ] **Step 1: Write failing rendered-contract assertions**

Extend the page test to instantiate an in-progress run and assert that `run.groups` is projected, key-only mode retains full unresolved counts, and adding a temporary item clears and closes only the local editor after the durable promise resolves.

```ts
expect(page.data.run.groups[0]).toMatchObject({ title: "随身核心", itemCount: 5 });
page.changeView({ currentTarget: { dataset: { view: "key" } } });
expect(page.data.run.items).toHaveLength(2);
expect(page.data.run.unresolvedCount).toBe(12);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run tests/miniprogram/run-receipt-page.test.ts`

Expected: FAIL on the new grouped presentation and editor-close behavior.

- [ ] **Step 3: Replace the item-card loop with grouped rows**

Render an outer `run-group` loop and an inner `run-item` loop. The inner row contains title/status and condition/hint, then exactly two core state buttons. Render the following disclosure after those buttons:

```xml
<button class="text-button item-tools-toggle"
  data-item-id="{{checkItem.runItemId}}"
  bindtap="toggleItemTools">
  {{expandedItemId == checkItem.runItemId ? '收起调整' : (checkItem.oneTimeNote ? '调整与备注（已填写）' : '调整与备注')}}
</button>
```

Only the expanded item renders the existing up/down and private-note editor controls. Keep `notNeeded` as a core action rather than placing it in the disclosure.

- [ ] **Step 4: Collapse temporary entry and add the bottom action dock**

Render the temporary form only when `showTemporaryEditor` is true. Add a fixed/sticky dock with exactly the two primary run actions:

```xml
<view wx:if="{{run.isInProgress}}" class="bottom-dock run-dock">
  <button class="secondary-button" bindtap="toggleTemporaryEditor">临时加一项</button>
  <button class="primary-button" bindtap="finishRun" loading="{{busy}}">结束本次检查</button>
</view>
```

Keep discard, copy and native share in a clearly labelled end/share section in document flow. Keep the existing closure receipt title/message bindings byte-for-byte.

- [ ] **Step 5: Implement density CSS without fixed-height clipping**

Use 20rpx row padding, 29rpx/600 titles, 23rpx metadata, 1rpx separators, a 24rpx group radius and no per-item card shadow. Long labels wrap naturally; `.run-page` reserves `calc(176rpx + env(safe-area-inset-bottom))` so the dock never covers the last item.

- [ ] **Step 6: Verify GREEN and commit**

Run: `pnpm vitest run tests/miniprogram/run-view.test.ts tests/miniprogram/run-receipt-page.test.ts tests/miniprogram/vertical-slice.test.ts tests/miniprogram/full-v1.test.ts`

Run: `pnpm miniprogram:verify`

Commit: `feat(wechat): restore dense run experience`

### Task 4: 恢复首页、模板库与模板详情的开放列表层级

**Files:**

- Modify: `miniprogram/pages/home/home.wxml`
- Modify: `miniprogram/pages/home/home.wxss`
- Modify: `miniprogram/pages/templates/templates.wxml`
- Modify: `miniprogram/pages/templates/templates.wxss`
- Modify: `miniprogram/pages/template-detail/template-detail.wxml`
- Modify: `miniprogram/pages/template-detail/template-detail.wxss`
- Create: `tests/miniprogram/ui-structure.test.ts`
- Modify: `tests/miniprogram/navigation-state.test.ts`
- Modify: `tests/miniprogram/full-v1.test.ts`

**Interfaces:**

- Home continues to consume exactly `continueRun`, `pendingPlans`, `quickTemplates`, `featuredTemplates` and the existing navigation/start handlers.
- Template library list rows expose only `startTemplate` and `openDetail`; governance remains reachable through template detail handlers.
- Template detail retains all official and personal governance handlers and the `createPlan` / `startTemplate` bottom actions.

- [ ] **Step 1: Add the failing compact-action contract**

Read the two native markup artifacts through a small `boundHandlers(markup)` parser. Assert that template-library rows expose only the high-frequency `startTemplate` and `openDetail` handlers, while all low-frequency governance remains present on template detail:

```ts
expect(boundHandlers(templateMarkup)).toEqual(expect.arrayContaining([
  "startTemplate",
  "openDetail",
]));
const governanceHandlers = [
  "toggleFavorite",
  "toggleHidden",
  "deriveOfficial",
  "editPersonal",
  "copyPersonal",
  "deletePersonal",
] as const;
expect(boundHandlers(templateMarkup).filter((handler) =>
  governanceHandlers.includes(handler as typeof governanceHandlers[number]),
)).toEqual([]);
expect(boundHandlers(detailMarkup)).toEqual(expect.arrayContaining([
  ...governanceHandlers,
]));
```

The production break caught is allowing low-frequency management to expand every list row again or removing the only remaining native path to a frozen capability. Keep the existing navigation-state tests as the independent identity/URL invariant.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run tests/miniprogram/ui-structure.test.ts tests/miniprogram/navigation-state.test.ts tests/miniprogram/full-v1.test.ts`

Expected: FAIL because the current library markup still binds favorite, hidden, derivative, edit, copy and delete actions directly on every row.

- [ ] **Step 3: Rebuild the Home hierarchy**

Keep the frozen section order. Shrink Hero to eyebrow/title/subtitle and convert the trust pill to quiet metadata. Keep search/new as the top tool row and plan/history/data as compact text actions. Keep one continue surface. Render upcoming, favorites and featured templates as `.list-surface > .list-row`, with direct start as the primary row action and detail as the secondary text action.

- [ ] **Step 4: Rebuild Template Library rows**

Use one grouped list for personal templates and one for all 13 official templates. Each row renders identity/status badges, title, applicability, item count and only `开始 / 详情`. Keep hidden official entries visible with `已隐藏入口`; keep deleted-personal recovery as a disclosure after the two lists.

- [ ] **Step 5: Rebuild Template Detail and safe bottom dock**

Keep one light governance surface. Use group surfaces with divider rows for items and flex-align key badges with titles. Move `安排计划 / 开始检查` into `.bottom-dock`; add `.page-with-dock` to preserve `userTip` and the final item above the safe area.

- [ ] **Step 6: Verify GREEN and commit**

Run: `pnpm vitest run tests/miniprogram/ui-structure.test.ts tests/miniprogram/navigation-state.test.ts tests/miniprogram/full-v1.test.ts tests/miniprogram/project-verifier.test.ts`

Run: `pnpm miniprogram:verify`

Commit: `feat(wechat): simplify home and template flows`

### Task 5: 扩散同一视觉系统到其余七页

**Files:**

- Modify: `miniprogram/pages/more-runs/more-runs.wxml`
- Modify: `miniprogram/pages/more-runs/more-runs.wxss`
- Modify: `miniprogram/pages/plans/plans.wxml`
- Modify: `miniprogram/pages/plans/plans.wxss`
- Modify: `miniprogram/pages/history/history.wxml`
- Modify: `miniprogram/pages/history/history.wxss`
- Modify: `miniprogram/pages/history-detail/history-detail.wxml`
- Modify: `miniprogram/pages/history-detail/history-detail.wxss`
- Modify: `miniprogram/pages/search/search.wxml`
- Modify: `miniprogram/pages/search/search.wxss`
- Modify: `miniprogram/pages/template-edit/template-edit.wxml`
- Modify: `miniprogram/pages/template-edit/template-edit.wxss`
- Modify: `miniprogram/pages/data/data.wxml`
- Modify: `miniprogram/pages/data/data.wxss`

**Interfaces:**

- No new Page handler or service interface is introduced in this task.
- More Runs retains `openRun` and `openTemplates`.
- Plans retains date/time snapshot creation, calendar capability honesty, start and cancel.
- History/History Detail retain truthful close types, reopen/restart paths, copy and native share.
- Search retains frozen local weighting; Template Edit retains personal-only save; Data retains backup/restore/reset ordering and copy.

- [ ] **Step 1: Run the existing behavioral suite before markup edits**

Run: `pnpm vitest run tests/miniprogram/full-v1.test.ts tests/miniprogram/platform.test.ts tests/miniprogram/navigation-state.test.ts tests/conformance/miniprogram-contract.test.ts`

Expected: PASS; record this as the pre-edit behavior baseline.

- [ ] **Step 2: Convert More Runs, Plans and History to open lists**

Use `.list-surface` and `.list-row`. More Runs renders title, handled/total, unresolved/key counts, last interaction and one Continue action. Plans keeps its form as one surface, then renders pending plans as rows with Start primary and Cancel text/danger secondary. History rows preserve status labels, close time, counts, detail/copy and conditional reopen.

- [ ] **Step 3: Convert History Detail to grouped read-only facts**

Render the fact summary as a soft surface, item facts as divider rows, and keep the action surface distinct. Preserve private notes on the local read-only page while keeping the existing no-note share/copy service.

- [ ] **Step 4: Convert Search and Template Edit**

Keep the search box as the dominant surface and render results as compact rows with `开始 / 详情`. Keep template preview, name, line editor, icon, theme and long-list warning; flatten nested cards and retain the disabled Save behavior.

- [ ] **Step 5: Group Data by protection, export, restore, capabilities and reset**

Keep all frozen trust copy. Use light group surfaces for ordinary facts, one warning surface for restore and one warning surface for reset. Do not weaken “刚刚生成（不等于已异地保存）”“当前数据未改变” or the protective-copy language.

- [ ] **Step 6: Verify all seven pages and commit**

Run: `pnpm vitest run tests/miniprogram tests/conformance/miniprogram-contract.test.ts`

Run: `pnpm miniprogram:verify`

Expected: all existing semantic, platform, navigation, handler and release checks remain green.

Commit: `feat(wechat): unify native visual hierarchy`

### Task 6: 完整质量门、官方工具视觉证据与体验构建

**Files:**

- Create: `evidence/wechat/ui-restoration-2026-08-31/01-home-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/02-templates-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/03-template-detail-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/04-run-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/05-run-key-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/06-run-not-needed-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/07-run-end-confirm-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/08-run-completed-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/09-run-unresolved-ios.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/10-home-android.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/11-run-android.png`
- Create: `evidence/wechat/ui-restoration-2026-08-31/design-qa.md`
- Create: `evidence/wechat/ui-restoration-2026-08-31/tool-results.md`
- Modify: `evidence/requirements-matrix.md`

**Interfaces:**

- Consumes: the committed source, old audit screenshots, `docs/design/visual-concept-v1.1.png`, official WeChat Developer Tools and the existing test AppID.
- Produces: command evidence, same-viewport visual comparisons, simulator/platform labels, preview/upload facts and any remaining physical-device-only gaps.

- [ ] **Step 1: Run every repository gate from a clean process**

Run, in order:

```text
pnpm runtime:check
pnpm install --frozen-lockfile
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:boundaries
pnpm miniprogram:verify
pnpm e2e
git diff --check
```

Expected: all commands exit 0; content remains byte-stable; PWA behavior is unchanged; WeChat reports 11 pages and 13 templates.

- [ ] **Step 2: Compile all 11 pages in official WeChat Developer Tools**

Use the existing project and AppID. Record the exact tool version, base library, compile result, package size, device profile and account identity class without copying secrets.

- [ ] **Step 3: Capture the required iOS states at 390 × 844**

Capture the four core pages plus key-only, notNeeded, key-risk end confirmation, completed receipt and unresolved receipt. For the default `日常出门` Run, the screenshot must show Header, view switch and at least four complete item titles; every visible core state button must remain at least 44px high.

- [ ] **Step 4: Capture Android default-font evidence**

Capture Home and the same ordinary Run state. Record any difference in Chinese baseline, button centering, safe-area spacing, wrapping or horizontal overflow.

- [ ] **Step 5: Run blocking visual comparison**

Compare each new core screenshot at the same viewport against both `docs/design/visual-concept-v1.1.png` and the matching old audit screenshot. In `design-qa.md`, score hierarchy, density, typography, button baseline, spacing, border/radius, safe area, wrapping and interaction reachability. Fix every P0/P1/P2 issue, recapture, and repeat until `final result: passed`; list only remaining P3 polish.

- [ ] **Step 6: Generate preview and upload a new trial build**

Use official developer tooling. Record preview success and real package size. Upload a new experience build only after visual QA passes; preserve the returned version/description and upload result. If WeChat requires a user-only scan or administrator click, request only that single action and resume immediately afterward.

- [ ] **Step 7: Update evidence, commit and push**

Update only matrix rows supported by commands or tool actions actually executed. Distinguish simulator, experience build, physical-device preview, review and formal release.

Commit: `docs: record WeChat visual restoration evidence`

Push the fast-forward result to `origin/codex/v1.1-implementation`; after all gates and evidence are green, fast-forward `origin/main` to the same reviewed commit.

## Self-Review Result

- Spec sections 1–9 map to Tasks 1–5; evidence and completion sections 10–12 map to Task 6.
- Run grouping preserves stable identities and global order; the key-only filter changes only visible items, not unresolved counts or completion facts.
- Every new Page field is presentation-only; no new field enters AppSnapshot, Backup Envelope or share output.
- Every runtime behavior change has a named RED/GREEN test; pure WXML/WXSS expansion remains protected by handler, verifier and existing service/conformance suites.
- Official content, domain packages, contracts, persistent store/service and PWA UI are outside the modification list.
- The plan contains no unresolved implementation choice; external WeChat account actions are requested only if the official tool blocks on a user-only step.
