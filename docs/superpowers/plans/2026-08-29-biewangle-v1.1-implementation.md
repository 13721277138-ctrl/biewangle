# 别忘了 V1.1 双端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付严格符合 V1.1 正式主源的 PWA 与微信原生小程序，并推进测试、真实终端、HTTPS 部署和发布链到当前环境/账号权限上限。

**Architecture:** 一个无平台依赖的 TypeScript 领域包集中定义状态机、快照、排序、搜索、备份和 migration；PWA 与微信分别实现 UI 和 durable persistence 适配器。官方 Markdown 通过确定性编译器生成共享内容，两个平台适配器对同一 Golden Fixtures 执行合规测试。

**Tech Stack:** pnpm workspace、TypeScript、Vitest、Zod、React 19、Vite、Dexie、vite-plugin-pwa/Workbox、Playwright；微信原生 WXML/WXSS/JavaScript 与 Node 合规测试。

**Spec:** `docs/superpowers/specs/2026-08-29-biewangle-v1.1-design.md`

## Global Constraints

- 产品行为与范围以 `docs/01_别忘了_产品定义与冻结规格_V1.1.md` 为最高主源。
- 官方模板正文与身份以 `docs/02_别忘了_官方模板内容库_V1.1.md` 为唯一内容主源，禁止自行改写。
- 工程顺序严格执行 G0 → G1 → G2 → G3 → G4 → G5 → G6；G1 未全绿前不铺双端大页面。
- CheckRun 核心状态仅 `inProgress | completed | endedWithUnresolved | discarded`；`reopened` 与 `closedEvents` 是事件，History 是只读投影。
- PlannedCheck 创建与 CheckRun 启动必须冻结快照；模板后续变化不得静默改写事实。
- durable write 成功前 UI 不得宣称保存成功；失败必须回滚或明确显示未保存。
- 无产品账号、无自动云同步、无 AI、无远程 Analytics、无广告、无运行时远程字体/CDN。
- `REOPEN_WINDOW_HOURS=2`、`STALE_AFTER_HOURS=24`、`PERSONALIZATION_MIN_REPEAT=3`、`HOME_RECENT_USE_DAYS=30` 集中配置。
- PWA mobile-first，375/390px、触控目标 ≥44px、Offline-first Core；Mac 管理页做大屏增强。
- 微信用原生页面与原生分享；平台能力缺失时诚实降级。
- Web Push/微信订阅消息只有后台与账号链路可靠时实现；本计划默认保持 L0 应用内提示和 L1 日历导出/写入。

---

### Task 1: 仓库基线、内容编译器与正式 Schema

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `AGENTS.md`
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/schema.ts`, `packages/domain/src/config.ts`
- Create: `scripts/compile-official-templates.ts`, `scripts/verify-package-manifest.mjs`
- Create: `shared-content/official-templates.v1.1.json`
- Test: `packages/domain/test/schema.test.ts`, `tests/content/official-templates.test.ts`

**Interfaces:**

- Produces: `OfficialTemplateSchema`, `AppSnapshotSchema`, `BackupEnvelopeSchema`, `PRODUCT_CONFIG`, deterministic `compileOfficialTemplates(markdown: string): OfficialContentBundle`.
- Consumes: V1.1 Markdown and `contracts/official-templates.v1.1.json`.

- [ ] **Step 1: Write failing integrity tests**

```ts
expect(bundle.templates).toHaveLength(13);
expect(allItems).toHaveLength(244);
expect(new Set(allItems.map(item => item.itemId)).size).toBe(244);
expect(featuredOrders).toEqual([1, 2, 3, 4, 5, 6, 7]);
expect(generatedJson).toBe(committedJson);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/content/official-templates.test.ts packages/domain/test/schema.test.ts`

Expected: FAIL because compiler, Schema and generated asset do not exist.

- [ ] **Step 3: Implement minimal workspace, Schema and Markdown compiler**

```ts
export const CheckRunStatusSchema = z.enum([
  "inProgress",
  "completed",
  "endedWithUnresolved",
  "discarded",
]);

export const PRODUCT_CONFIG = Object.freeze({
  REOPEN_WINDOW_HOURS: 2,
  STALE_AFTER_HOURS: 24,
  PERSONALIZATION_MIN_REPEAT: 3,
  HOME_RECENT_USE_DAYS: 30,
});
```

- [ ] **Step 4: Generate and compare official content**

Run: `pnpm content:generate && pnpm content:check`

Expected: generated JSON is byte-stable and semantically equal to the supplied contract.

- [ ] **Step 5: Verify GREEN and commit**

Run: `pnpm vitest run tests/content/official-templates.test.ts packages/domain/test/schema.test.ts`

Commit: `feat(domain): establish official content and schemas`

### Task 2: CheckRun、PlannedCheck、排序、搜索与分享纯领域合同

**Files:**

- Create: `packages/domain/src/run.ts`, `packages/domain/src/plan.ts`, `packages/domain/src/home.ts`
- Create: `packages/domain/src/search.ts`, `packages/domain/src/share.ts`, `packages/domain/src/index.ts`
- Test: `packages/domain/test/run.test.ts`, `packages/domain/test/plan.test.ts`
- Test: `packages/domain/test/home.test.ts`, `packages/domain/test/search.test.ts`, `packages/domain/test/share.test.ts`
- Test: `tests/conformance/domain-contract.test.ts`

**Interfaces:**

- Produces: `startRun`, `toggleConfirmed`, `markNotNeeded`, `addTemporaryItem`, `reorderRunItems`, `closeRun`, `reopenRun`, `restartFromHistory`.
- Produces: `createPlannedCheck`, `startPlannedCheck`, `cancelPlannedCheck`, `rankContinueRuns`, `rankUpcomingPlans`, `searchTemplates`, `buildSharePreview`.
- Every mutation returns a new immutable aggregate and never mutates a source template.

- [ ] **Step 1: Write failing state-machine and Golden Contract tests**

```ts
const runA = markNotNeeded(startRun(template, now), "daily.umbrella", now);
const runB = startRun(template, later);
expect(runA.items.find(i => i.sourceItemId === "daily.umbrella")?.state).toBe("notNeeded");
expect(runB.items.find(i => i.sourceItemId === "daily.umbrella")?.state).toBe("unchecked");
expect(template.groups[1].items[2]).not.toHaveProperty("state");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run packages/domain/test tests/conformance/domain-contract.test.ts`

Expected: FAIL on missing exported domain functions.

- [ ] **Step 3: Implement minimal immutable transitions and truthful close result**

```ts
type CloseRunResult =
  | { kind: "completed"; run: CheckRun }
  | { kind: "needsKeyConfirmation"; unresolvedCount: number; unresolvedKeyCount: number }
  | { kind: "endedWithUnresolved"; run: CheckRun }
  | { kind: "rejected"; reason: string };
```

- [ ] **Step 4: Implement deterministic ranking, weighted local search and privacy-safe share projections**

Search weights are literal constants in title → aliases → item title → applicability → hint order. Share preview excludes `oneTimeNote` unless the result-sharing action explicitly opts in after preview.

- [ ] **Step 5: Verify GREEN, run mutation review and commit**

Run: `pnpm vitest run packages/domain/test tests/conformance/domain-contract.test.ts`

Commit: `feat(domain): implement v1.1 behavior contracts`

### Task 3: Backup、migration 与 durable persistence 合同

**Files:**

- Create: `packages/domain/src/backup.ts`, `packages/domain/src/migration.ts`, `packages/domain/src/reset.ts`
- Create: `packages/persistence-contract/src/index.ts`
- Test: `packages/domain/test/backup.test.ts`, `packages/domain/test/migration.test.ts`, `packages/domain/test/reset.test.ts`
- Test: `packages/persistence-contract/test/write-contract.test.ts`

**Interfaces:**

- Produces: `exportBackup(snapshot, platform, now)`, `parseAndValidateBackup(text)`, `migrateSnapshot(old)`, `prepareReset(snapshot)`.
- Produces: `DurableStore<T> { load(): Promise<T>; commit(next: T): Promise<void>; protectiveCopy(label: string): Promise<void> }`.
- Restore services commit only after parse, version, Schema and business validation all pass.

- [ ] **Step 1: Write failing success and failure-path tests**

```ts
await expect(restoreFromText(validCurrent, futureVersionJson, store)).rejects.toThrow("不支持的备份格式版本");
expect(await store.load()).toEqual(validCurrent);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run packages/domain/test/backup.test.ts packages/domain/test/migration.test.ts packages/persistence-contract/test`

Expected: FAIL because restore/migration and store contract are absent.

- [ ] **Step 3: Implement staged validation and atomic commit services**

```ts
const candidate = validateBusinessInvariants(
  migrateSupportedSchema(parseEnvelope(raw).data),
);
await store.protectiveCopy("before-restore");
await store.commit(candidate);
```

- [ ] **Step 4: Add injected open/write/quota/interruption failures**

Each fake failure asserts durable state remains unchanged and the caller receives a typed visible error.

- [ ] **Step 5: Verify GREEN and commit**

Run: `pnpm vitest run packages/domain packages/persistence-contract tests/conformance`

Commit: `feat(data): protect backup migration and writes`

### Task 4: PWA 存储、安装、更新与四模板纵向切片

**Files:**

- Create: `pwa/package.json`, `pwa/index.html`, `pwa/vite.config.ts`, `pwa/playwright.config.ts`
- Create: `pwa/src/main.tsx`, `pwa/src/app/App.tsx`, `pwa/src/app/router.tsx`
- Create: `pwa/src/data/db.ts`, `pwa/src/data/durable-store.ts`, `pwa/src/data/use-app-store.ts`
- Create: `pwa/src/features/home/HomePage.tsx`, `pwa/src/features/run/RunPage.tsx`, `pwa/src/features/plans/PlanFormPage.tsx`
- Create: `pwa/src/features/history/HistoryPage.tsx`, `pwa/src/features/data/DataPage.tsx`
- Create: `pwa/src/styles/tokens.css`, `pwa/src/styles/global.css`
- Create: `pwa/public/manifest.webmanifest`, PWA icons
- Test: `pwa/src/**/*.test.tsx`, `pwa/e2e/vertical-slice.spec.ts`, `pwa/e2e/offline.spec.ts`

**Interfaces:**

- PWA UI consumes domain commands through `AppRepository`; components never write IndexedDB directly.
- `commitCommand(command)` publishes next UI state only after `Dexie.transaction("rw", ...)` resolves.
- Service worker exposes a user-controlled update prompt and preserves active Run continuity.

- [ ] **Step 1: Write failing repository/UI tests for direct start, three states and visible write failure**

```tsx
await user.click(screen.getByRole("button", { name: "确认 手机" }));
expect(await screen.findByText("未保存，请重试")).toBeVisible();
expect(screen.getByRole("button", { name: "确认 手机" })).toHaveAttribute("aria-pressed", "false");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @biewangle/pwa test --run`

Expected: FAIL because PWA repository and screens are missing.

- [ ] **Step 3: Implement design tokens, responsive shell and vertical flow**

Use only four slice templates on the first pass: `official.daily_out`, `official.hotel_checkout`, `official.international_travel`, `official.important_medical_visit`.

- [ ] **Step 4: Implement IndexedDB, StorageManager status, manifest and conservative service worker update**

The data page distinguishes “本地持久保护” from “完整备份”.

- [ ] **Step 5: Run component tests and Playwright slice**

Run: `pnpm --filter @biewangle/pwa test --run && pnpm --filter @biewangle/pwa e2e --grep "vertical slice"`

- [ ] **Step 6: Run real offline cold-start automation**

Run: `pnpm --filter @biewangle/pwa build && pnpm --filter @biewangle/pwa e2e --grep "offline cold start"`

Expected: after online cache warmup, browser context offline restart resumes and completes a persisted Run.

- [ ] **Step 7: Commit**

Commit: `feat(pwa): deliver trusted vertical checklist slice`

### Task 5: PWA 完整 V1 页面、模板管理与数据治理

**Files:**

- Create/Modify: `pwa/src/features/templates/**`, `pwa/src/features/search/**`, `pwa/src/features/history/**`
- Create/Modify: `pwa/src/features/plans/**`, `pwa/src/features/data/**`, `pwa/src/features/settings/**`
- Create/Modify: `pwa/src/features/share/**`, `pwa/src/app/router.tsx`
- Test: corresponding component tests and `pwa/e2e/full-v1.spec.ts`, `pwa/e2e/responsive.spec.ts`, `pwa/e2e/accessibility.spec.ts`

**Interfaces:**

- Personal template permanent edits create/modify only PersonalTemplate; official originals remain immutable.
- Soft delete/restore acts only on personal templates.
- Human-readable export and JSON backup use domain projections; import never renders raw HTML.

- [ ] **Step 1: Write failing tests for all 13 templates, personal template lifecycle, plans, search, history, sharing and reset**

Run: `pnpm --filter @biewangle/pwa test --run`

Expected: FAIL on missing full-V1 routes and actions.

- [ ] **Step 2: Implement minimal full V1 feature slices**

Every form validates title/group/item identity and persists through `AppRepository`.

- [ ] **Step 3: Add Mac three-column management layouts and 375/390px safe-area layouts**

No hover dependency; no horizontal overflow; all primary controls are at least 44px.

- [ ] **Step 4: Verify full component, responsive and accessibility suites**

Run: `pnpm --filter @biewangle/pwa test --run && pnpm --filter @biewangle/pwa e2e --grep "full v1|responsive|accessibility"`

- [ ] **Step 5: Commit**

Commit: `feat(pwa): complete local-first v1 experience`

### Task 6: PWA 浏览器视觉 QA、性能、安全与 HTTPS 部署

**Files:**

- Create: `scripts/verify-runtime-boundaries.mjs`, `evidence/pwa/**`, `docs/deployment/pwa.md`
- Modify: PWA files only for issues reproduced by QA.

**Interfaces:**

- Evidence records command, timestamp, browser/viewport, expected fact and observed result.
- Public URL must serve HTTPS, manifest, service worker and navigation fallback.

- [ ] **Step 1: Run full automated gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`

- [ ] **Step 2: Start production preview and use Browser/IAB for core workflow**

Verify home → direct Run → confirmed/notNeeded/temp/note → unresolved/key confirmation → reopen → history → backup/restore.

- [ ] **Step 3: Capture 390px and desktop screenshots and compare with `docs/design/visual-concept-v1.1.png` using `view_image`**

Record at least copy, hierarchy, palette, list anatomy, touch sizing, desktop information density and responsive behavior.

- [ ] **Step 4: Run Lighthouse-equivalent audits and runtime boundary scan**

No remote font/CDN, Analytics, ad SDK, unsafe HTML or embedded secrets may appear.

- [ ] **Step 5: Deploy through the first authenticated static HTTPS provider and re-run critical E2E against the URL**

GitHub/hosting login is requested only here if no existing authenticated route is available.

- [ ] **Step 6: Commit**

Commit: `test(pwa): verify and deploy production build`

### Task 7: 微信 durable store 与原生四模板纵向切片

**Files:**

- Create: `miniprogram/project.config.json`, `miniprogram/app.js`, `miniprogram/app.json`, `miniprogram/app.wxss`
- Create: `miniprogram/lib/domain.js`, `miniprogram/lib/store.js`, `miniprogram/lib/platform.js`
- Create: `miniprogram/pages/home/**`, `miniprogram/pages/run/**`, `miniprogram/pages/plans/**`, `miniprogram/pages/history/**`, `miniprogram/pages/data/**`
- Test: `tests/miniprogram/store.test.ts`, `tests/miniprogram/vertical-slice.test.ts`, `tests/conformance/miniprogram-contract.test.ts`

**Interfaces:**

- `WechatDurableStore.commit(next)` writes inactive slot, reads and validates it, then switches active pointer.
- Native pages call a small service facade and update WXML only after commit resolution.
- Platform wrapper feature-detects calendar, file sharing and update APIs.

- [ ] **Step 1: Write failing double-slot and adapter contract tests**

```ts
await expect(store.commit(nextSnapshot)).rejects.toThrow("本地保存失败");
expect(await store.load()).toEqual(previousSnapshot);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/miniprogram tests/conformance/miniprogram-contract.test.ts`

Expected: FAIL because native adapter and store do not exist.

- [ ] **Step 3: Implement store, service facade and native vertical pages**

Use the same four representative templates and same domain fixtures as PWA. WXML remains native and does not include `web-view`.

- [ ] **Step 4: Implement native share, copy, calendar and honest capability feedback**

Subscription message remains unavailable without template/account/backend and is never shown as configured.

- [ ] **Step 5: Verify GREEN and commit**

Run: `pnpm vitest run tests/miniprogram tests/conformance`

Commit: `feat(wechat): deliver native trusted vertical slice`

### Task 8: 微信完整 V1、开发者工具与发布链

**Files:**

- Create/Modify: `miniprogram/pages/templates/**`, `miniprogram/pages/template-edit/**`, `miniprogram/pages/search/**`
- Create/Modify: `miniprogram/pages/more-runs/**`, `miniprogram/pages/history-detail/**`, `miniprogram/pages/data/**`
- Create: `scripts/verify-miniprogram.mjs`, `evidence/wechat/**`, `docs/deployment/wechat.md`
- Test: `tests/miniprogram/full-v1.test.ts`, all conformance tests.

**Interfaces:**

- All 13 official templates ship from generated content.
- Backup Envelope semantics match PWA; mobile import uses WeChat chat file selection and export uses file share/copy.

- [ ] **Step 1: Write failing full-V1 native behavior tests**

Run: `pnpm vitest run tests/miniprogram/full-v1.test.ts`

Expected: FAIL on missing routes/actions.

- [ ] **Step 2: Implement remaining native pages and feature adaptations**

- [ ] **Step 3: Run static project verifier and all cross-platform contracts**

Run: `pnpm miniprogram:verify && pnpm vitest run tests/miniprogram tests/conformance`

- [ ] **Step 4: Install/open official developer tools and compile project**

If login/AppID blocks this exact step, request only that action; after authorization continue to preview, real device, trial, pre-review and submission as permissions allow.

- [ ] **Step 5: Record actual terminal stage and commit**

Commit: `feat(wechat): complete native v1 delivery chain`

### Task 9: G6 证据包、GitHub 与 Codex Cloud 可复现状态

**Files:**

- Create: `evidence/requirements-matrix.md`, `evidence/final-delivery-report.md`
- Create: `.github/workflows/ci.yml`, `.github/workflows/pages.yml` or provider equivalent
- Modify: `README.md`, `AGENTS.md`, deployment docs.

**Interfaces:**

- Requirement matrix maps each P0/P1 requirement to PWA evidence, 微信 evidence, automated contract and actual terminal state.
- Cloud setup needs only repo checkout plus `pnpm install --frozen-lockfile`; `AGENTS.md` contains exact commands.

- [ ] **Step 1: Run fresh complete verification**

Run: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e && pnpm miniprogram:verify`

- [ ] **Step 2: Re-read all 26 minimum invariants and map evidence line by line**

No requirement is marked verified without a command output, browser run or real device record from this development run.

- [ ] **Step 3: Create/push GitHub repository when authenticated**

Run after authorization: `gh repo create biewangle --source=. --private --remote=origin --push`

Repository visibility can be changed by the owner later; no public exposure is assumed.

- [ ] **Step 4: Confirm Codex Cloud readiness**

Verify remote default branch contains `AGENTS.md`, lockfile, CI and reproducible setup. Official Codex Cloud still requires the user to connect/select the GitHub repository in account settings.

- [ ] **Step 5: Complete final report and finish branch**

Report deployed URL, repo state, commands/results, offline/persistence/backup/migration evidence, PWA terminal shapes, 微信 stage, capability matrix, external blockers, known defects and only the remaining minimum user actions.

