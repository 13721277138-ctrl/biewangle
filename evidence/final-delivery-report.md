# 别忘了 V1.1 最终真实交付报告

报告时间：2026-09-01（Asia/Shanghai）

## 结论

当前环境内可替代的开发、测试、修复、Git、GitHub、PWA 部署、微信官方工具验证和测试号体验构建均已推进到真实可检查状态：

- A 类 9 项不可降级产品硬门全部有自动合同和适用终端证据；
- 26 项最低关键不变量逐条映射并全绿；
- PWA 最新完整代码已部署到 GitHub Pages，并在公网重新运行 8/8 E2E；
- 微信端已完成原生 11 页、13 模板、官方模拟器业务闭环、iOS/HarmonyOS/Android 核心页与 Android 次级 7 页默认字体视觉复验、手机自动预览推送和测试号 `1.1.0` 体验构建重新上传；
- GitHub 默认分支包含 lockfile、`AGENTS.md`、全分支 CI、Pages 发布门和可复现说明；
- Codex Cloud 已真实关联仓库并创建 `biewangle-v1.1-node24` 环境；首个只读完整门禁任务为 `READY / no diff`；
- iPhone/iPad 主屏、Mac Add to Dock、微信物理手机完整回归、正式小程序审核/发布仍是外部终端或账号动作，不以自动化推定通过。

因此，本报告声明的是：

> **G6 代码与证据交付及 Codex Cloud 复现环境已达到当前环境/权限允许的最高真实状态；PWA 已公网发布；微信已到测试号体验构建；全终端与微信正式上线仍有明确外部阻塞。**

不声明“所有平台正式上线”或“所有 P1 真机门完成”。

## 1. PWA 真实 URL

- 生产地址：<https://13721277138-ctrl.github.io/biewangle/>
- GitHub 仓库：<https://github.com/13721277138-ctrl/biewangle>
- 仓库主页字段已设置为生产地址。

2026-08-31 最新公网端点：

| 端点 | 结果 |
|---|---|
| `/biewangle/` | HTTP 200，`text/html; charset=utf-8` |
| `/biewangle/manifest.webmanifest` | HTTP 200，`application/manifest+json; charset=utf-8` |
| `/biewangle/sw.js` | HTTP 200，`application/javascript; charset=utf-8` |
| `/biewangle/icons/icon-192.png` | HTTP 200，`image/png` |
| `/biewangle/templates/new` 首次直开 | GitHub Pages 先返回 404 文档，客户端恢复真实深层路径；公网 E2E 通过 |

## 2. 代码仓库 / 目录状态

- 本地目录：`/Users/thy/Documents/ChatGPT/忘了吗`
- 远端：`origin = https://github.com/13721277138-ctrl/biewangle.git`
- 默认分支：`main`
- 开发分支：`codex/v1.1-implementation`
- 微信视觉整改实现与证据检查点：`dfe96f9`（包含跨 iOS/HarmonyOS/Android 官方模拟器证据与最新体验构建事实）
- `main` 与开发分支均以纯快进方式包含该检查点；无强推、无历史改写。
- 本报告后续只记录该检查点的 GitHub CI / Pages 结果，不改变已验证产品运行时。

关键提交：

```text
dfe96f9 docs: complete WeChat visual restoration evidence
50434d6 docs: add HarmonyOS visual evidence
8d8f919 docs: record WeChat iOS visual restoration evidence
628da86 feat(wechat): unify native visual hierarchy
14e76cf feat(wechat): simplify home and template flows
eb12c72 feat(wechat): restore dense run experience
af00e96 refactor(wechat): project dense run groups
e1a7e47 test(wechat): enforce visual foundation
47a5e90 docs: record verified Cloud bootstrap
1b3cb5f ci: pin Codex Cloud runtime
745bb19 ci: update pages artifact runtime
92acc97 ci: add reproducible g6 delivery gates
29e6e7b feat(wechat): complete native v1 delivery chain
6c2e4ec feat(wechat): deliver native trusted vertical slice
fbbc6d1 docs(pwa): record verified public deployment
b35f0f4 feat(pwa): complete local-first v1 experience
```

## 3. 已实现功能

### 共享领域与数据

- OfficialTemplate、PersonalTemplate、PlannedCheck、CheckRun、CheckRunItem、AppSettings、SoftDeletedPersonalTemplate、BackupEnvelope；
- History 是 CheckRun + append-only `closedEvents` 的只读投影，不是第二真相源；
- Run / Planned Snapshot 冻结；同模板多 Run 独立；本次状态绝不反写模板；
- `unchecked`、`confirmed`、`notNeeded` 三状态；关键项视图不改变完成计算；
- `completed`、`endedWithUnresolved`、`discarded` 互斥关闭语义；2 小时内重开保留历史关闭事实；
- JSON Backup Envelope、可读文本、10 MB 导入上限、保护副本、恢复/迁移/重置原子边界；
- schema / writer 兼容门、未来版本拒绝和 native 双槽恢复指针修复；
- 13 个官方模板、244 个稳定 itemId、7 个精选位置由冻结 Markdown 确定性生成。

### PWA

- 完整模板库、搜索、收藏、隐藏/恢复；
- 个人模板新建、编辑、复制/派生、软删除/恢复；
- 直接开始、计划开始、全部进行中、Run 三状态、临时项、私密备注、本次排序、关键项过滤；
- 计划、提前开始、取消、L0 应用内提示、`.ics` 日历导出；
- History、历史详情、重开/重新开始；
- 分享预览默认排除一次性私密备注；
- IndexedDB、持久存储能力说明、完整备份、可读导出、保护恢复与强确认重置；
- Service Worker 离线冷启动、子路径部署、深链恢复、安装 manifest；
- 375/390 px 手机布局、1440 px 桌面管理布局、WCAG/键盘/reduced-motion 自动门。

### 微信原生

- 独立 WXML / WXSS / JavaScript；11 页完整 V1；不含 `web-view`；
- 13 官方模板、个人模板生命周期、固定搜索、收藏/隐藏；
- 多 Run、三状态、关键项、临时项、备注、排序、中断恢复与真实关闭回执；
- 计划、History、历史详情、重开/重新开始；
- 本地双槽快照、保护副本、JSON/可读导出、聊天 JSON 导入预览、恢复和强确认重置；
- native clipboard、日历、文件分享、页面分享与更新能力 feature detect；
- 无网络、云开发、产品账号、追踪 SDK 或运行时 CDN。

## 4. 自动测试命令与结果摘要

本地普通工作树和一个无 `node_modules` / 无 `pwa/dist` 的临时干净 clone 均按同一顺序执行：

```sh
pnpm install --frozen-lockfile
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:boundaries
pnpm miniprogram:verify
pnpm e2e
```

结果：

```text
install               PASS（pnpm 11.19.0，frozen lockfile）
content:check         PASS（Markdown = shared JSON = 微信派生 JS）
lint                  PASS
typecheck             PASS
test                  PASS（31 files, 158 tests）
build                 PASS（1962 modules；35 precache entries；573.51 KiB）
verify:boundaries     PASS（41 authored files, 40 production files）
miniprogram:verify    PASS（11 pages, 13 templates, 247764 bytes）
e2e local             PASS（8 / 8）
e2e public            PASS（8 / 8，约 1.0 min）
git diff --check      PASS
credential scan       PASS（安全测试中的故意假密钥 fixture 排除后）
```

GitHub 干净 Ubuntu 验证：

- 视觉整改开发分支 CI：[`33454860954`](https://github.com/13721277138-ctrl/biewangle/actions/runs/33454860954)，success；
- `main` 全仓 CI：[`33454980793`](https://github.com/13721277138-ctrl/biewangle/actions/runs/33454980793)，success；
- `main` Pages：[`33454980752`](https://github.com/13721277138-ctrl/biewangle/actions/runs/33454980752)，build + deploy success；
- `dfe96f9` 的 branch verify、main verify、Pages build、Pages deploy 四个 check-run annotation 均为 0；
- Pages 完成后重新请求生产首页、manifest、Service Worker 与 192 图标，均返回 HTTP 200 和预期 MIME。

Codex Cloud 首次只读复现（历史基线 `47a5e90`，不外推为视觉提交已在 Cloud 重跑）：

- Environment：[`biewangle-v1.1-node24`](https://chatgpt.com/codex/cloud/settings/environment/6a956037720c8191b93874a0a9d38999)；
- Task：[`task_e_6a95609835a48332905b04202b683d1d`](https://chatgpt.com/codex/tasks/task_e_6a95609835a48332905b04202b683d1d)，`READY / no diff`；
- `main` HEAD `47a5e900087b8eb5946dc6b54f9c141c3f32349b`；
- Node.js `v24.20.0`、pnpm `11.19.0`；
- 27/27 测试文件、148/148 测试、8/8 E2E、11 页/13 模板门禁全部退出状态 `0`；
- 最终 `git status --short` 为空，未修改文件、未提交、未开 PR。

## 5. Domain contract 结果

- `contracts/domain-contract-cases.v1.1.json`：27 个唯一 Golden Cases；
- `tests/conformance/domain-contract.test.ts`：每个冻结 case 都必须映射到可执行 gate；
- `tests/conformance/miniprogram-contract.test.ts`：shared/native 的四代表模板、Run、Plan、Backup Envelope、严格 schema、可读导出与关闭回执差分一致；
- 语义专项补齐计划/Run 冻结事实深度链接、关闭/重开 lineage、严格 ISO/安全整数和临时项默认 ID 双端一致；
- 26 项最低不变量详见 [`requirements-matrix.md`](requirements-matrix.md)。

## 6. 关键 E2E 结果

8 条本地与公网 Chrome 接受测试全部通过：

1. 主要页面 WCAG A/AA；
2. 键盘焦点与 reduced motion；
3. 个人模板 → 私密备注 → 诚实历史 → 备份 → 重置 → 恢复；
4. IndexedDB + Service Worker 离线冷启动；
5. 375 px 无溢出且触控导航可达；
6. 390 px 同上；
7. 1440 px 桌面管理列而非拉宽手机页；
8. 直接开始 → 三状态 → 临时项 → 诚实结束纵切。

公网测试不是对本地 preview 的替代变量：`PLAYWRIGHT_BASE_URL` 实际指向 GitHub Pages，并从深层 `/templates/new` 开始完整恢复链。

## 7. 离线冷启动

状态：`verified`。

联网完成缓存并启动 Run 后，测试关闭页面、建立离线上下文、重新导航生产入口，能从 IndexedDB 继续未完成 Run；再次关闭后 History 仍存在。该链在本地生产构建与公网 HTTPS 都已通过。

离线核心不依赖 CDN、API、登录或后端；构建产物全部进入 Workbox 预缓存。

## 8. Persistent Storage 能力与实测

- Chromium 环境确认 IndexedDB 真实写入/读回；
- `navigator.storage.persisted/persist` API 存在，但本机浏览器曾返回 `false`；
- 应用诚实显示“当前仍可使用，完整备份更可靠”，不把 API 拒绝写成持久化成功；
- Dexie 事务失败注入时不发布假成功；另一 repository 实例能读回已提交事实；
- 微信端使用异步双槽快照，候选写入并验证后才切换 active 指针；损坏槽/指针恢复后修复 active，避免下次覆盖可信槽。

状态：核心持久化 `verified`；浏览器抗系统清理保证为 `degraded`（平台事实）。

## 9. Backup / Restore 成功与失败路径

已验证成功路径：

- 生成完整 JSON Backup Envelope 并先持久化 `lastBackupAt`；
- 生成默认不含私密备注的 Markdown 可读导出；
- 导入前预览模板/计划/Run 数量；
- 先创建保护副本，再以完整已校验快照原子替换；
- PWA E2E 实际执行备份 → 重置 → 恢复；
- 微信官方模拟器实际执行备份 → 清空 → 恢复。

已验证失败路径：

- 非 JSON、schema 错误、业务不变量错误、未来 `backupFormatVersion`、冻结计划/Run 串线均拒绝；
- 保护副本失败或正式 commit 失败会显示操作错误；
- service 内存事实和 durable truth 都保持恢复前状态；
- 10 MB 上限在读取大文件前拒绝。

## 10. Migration 成功与失败路径

- 当前 schema 输入被验证并 clone，不复用可变引用；
- 可注册连续 migration step，逐步校验声明版本并最终通过 V1 schema；
- future schema、缺 step、step 抛错、step 产出错误版本均明确拒绝；
- durable migration 在执行前创建保护副本；migration 失败不 commit，旧数据保持原样；
- `minimumWriterVersion` 高于当前 writer 时，在触碰持久数据前转为只读错误。

状态：`verified`。V1.1 当前没有需要在真实用户数据上执行的历史生产迁移，因此不伪造“生产迁移已发生”。

## 11. PWA 三种实际使用形态

| 形态 | 实际状态 | 结论 |
|---|---|---|
| 公网普通浏览器 | GitHub Pages HTTPS、完整 E2E、离线冷启动、深链恢复 | `verified` |
| 手机尺寸 / 可安装 PWA | 375/390 Chrome 渲染与触控门通过；manifest/SW/CDP installability 无错误 | 形态 `verified`；iPhone/iPad 主屏真实点击 `blocked-external` |
| Mac 桌面 / 独立 Web App | 1440 桌面布局通过；当前 Mac 为 macOS 13.3.1 | 桌面网页形态 `verified`；Safari Add to Dock 需 Sonoma 14+，`blocked-external` |

不能用 Chrome 手机 viewport 代替 iPhone 主屏，也不能用 manifest 无错误代替从 Dock 实际启动。

## 12. 微信推进到的真实阶段

已达到：

```text
原生工程 → Node 静态发布门 → 官方逐页编译 → 官方模拟器完整业务闭环
→ 预览二维码打包 → 手机自动预览推送 → 测试号 1.1.0 体验构建上传
→ 数据语义专项修复 → 微信视觉整改 → iOS/HarmonyOS/Android 默认字体复验
→ 官方重新预览 / 重新上传
```

2026-09-01 官方稳定版开发者工具 `2.02.2608060`：

```text
create_preview_qrcode  success  package=190070 bytes
auto_preview           success  package=190070 bytes
upload 1.1.0           success  package=190569 bytes
```

没有达到：

- 物理手机手动完成全部最低回归并留证；
- 正式主体 / 生产 AppID；
- 公众平台审核；
- 审核通过后的正式发布。

当前阶段准确描述为“测试号体验构建”，不是“微信正式上线”。

## 13. 平台能力矩阵与降级

| 能力 | PWA | 微信 |
|---|---|---|
| 本地核心 | IndexedDB + Service Worker，`supported` | 本地双槽快照，`supported` |
| 持久存储保证 | StorageManager 可能拒绝，`degraded` | 微信存储可能被系统/卸载清理，`degraded` |
| 完整备份 | JSON 下载/导入，`supported` | JSON 分享/聊天选择，`supported/degraded` |
| 可读导出 | Markdown 下载/复制，`supported` | clipboard，`supported` |
| 平台分享 | Web Share feature detect，失败回退，`degraded` | 页面/文件原生分享，真实面板需用户手势 |
| 系统日历 | `.ics` 导出，`degraded` | `wx.addPhoneCalendar` feature detect，需权限 |
| Web Push / 订阅消息 | 需后端，未伪装配置 | 需模板 ID + 服务端，未伪装配置 |
| PWA 安装 | Chrome 安装性通过；iPhone/Mac 物理动作待补 | 不适用 |
| 正式发布 | GitHub Pages 已发布 | 正式账号/审核 `blocked-external` |

## 14. 外部真实阻塞

1. 当前没有可由 Codex 操作并留证的 iPhone/iPad 主屏 Web App 完整回归。
2. 当前 Mac 是 macOS 13.3.1，不能执行 Sonoma 14+ 的 Safari Add to Dock。
3. 微信测试号可以体验构建，但缺正式小程序主体、生产 AppID、开发/审核/发布权限。
4. 微信文件分享、聊天文件选择、系统日历和物理手机切后台恢复需要真实用户手势。

这些阻塞均不能靠代码、模拟器、CLI 登录或 README 替代。

## 15. 已知缺陷 / 限制与复现方法

### 产品运行时

本轮 158 测试、双端合同、官方微信工具和 8/8 E2E 未发现仍可稳定复现的 P0 产品缺陷。

仍有以下已知平台限制：

1. **GitHub Pages 深链服务器状态为 404**：直接 `curl -I https://13721277138-ctrl.github.io/biewangle/templates/new` 可见 404；浏览器加载仓库的 `404.html` 后恢复目标路由，E2E 已通过。对用户操作无白屏，但服务器型爬虫仍看到 404。
2. **本地数据可能被平台清理**：清站点数据、卸载小程序、设备故障或系统存储回收会删除事实。用完整 JSON 异地备份降低风险；这是 Local-first 平台边界，不是云同步承诺。
3. **微信视觉密度与字体基线整改已通过官方模拟器阻断复验**：整改前问题记录仍保留在 [`wechat/ui-audit-2026-08-31/audit.md`](wechat/ui-audit-2026-08-31/audit.md)；整改后证据见 [`wechat/ui-restoration-2026-08-31/design-qa.md`](wechat/ui-restoration-2026-08-31/design-qa.md)。iPhone 12/13 (Pro)、HUAWEI Mate 70 Pro / HarmonyOS、Nexus 5X / Android 默认字体下未发现 P0/P1/P2；Run 核心按钮为 44–48px，行内关键徽标/标题/状态最大 top 差值低于 1px。该结论不替代较大微信字体档、物理手机、屏幕阅读器或系统用户手势验证。
4. **Android 次级页面已补齐默认字体复验**：计划、历史、历史详情、数据、搜索、模板编辑和全部进行中共 7 页逐张证据见 [`wechat/secondary-pages-android-2026-09-01/audit.md`](wechat/secondary-pages-android-2026-09-01/audit.md)。其中模板编辑器内部 token 直出这一项 P2 已按测试先行修复；中文标签变化不改写 `icon` / `themeColor` 存储值。

### 证据缺口

- iPhone/iPad 主屏、Mac Add to Dock、微信物理手机完整流程和屏幕阅读器尚无真实终端记录；矩阵保持 `partial-external` / `blocked-external`。

## 16. 用户只需完成的最小动作

按优先级：

1. **PWA 真机**：在 iPhone/iPad Safari 打开生产 URL，添加到主屏，从图标完成一次 Run + 离线重开；把结果告诉 Codex。
2. **微信真机**：在当前开发者微信打开已推送的体验预览，按 `docs/deployment/wechat.md` 的最低回归走一次；文件/聊天/日历动作由用户手势完成。
3. **Mac 独立形态**：在 macOS Sonoma 14+ 的 Safari 添加到程序坞并完成一次核心检查；当前这台 Mac 无法替代。
4. **微信正式上线（只有确实要上线时）**：提供/选定正式小程序 AppID，把当前开发者加入该主体并授予所需权限；随后 Codex重新跑门、真机、上传、审核前检查，再把最终审核/发布点击交给有权限账号。

不需要用户手工复制代码、执行普通构建、创建 Git 仓库、配置 Pages 或自行整理测试报告。

## 17. V1 稳定验证期开始方式

PWA 公网版本从 2026-08-31 起可以进入稳定验证期；微信正式版本的稳定期从正式发布后单独开始。

冻结普通新功能约 2 周，并累计至少约 30 次真实 Check Run，覆盖：

- 短清单与长清单；
- 空间扫描与高后果模板；
- 计划提前开始；
- 切后台/中断恢复；
- 有未确认关键项后诚实结束；
- 2 小时内重开纠错；
- 备份、重置与恢复；
- 至少两类真实终端。

每次只记录：终端、模板、是否中断、关闭状态、是否仍反复回想、是否发生模板外重要遗漏、是否遇到语义困惑或数据异常。期间只修 Bug、明显主流程阻碍、数据可靠性/兼容性问题；普通新功能进入候选池，不立即开发。

约 2 周和约 30 次 Run 是两个都要达到的观察门，不是自动宣布价值成立。期末由人回答：是否愿意在相同场景再次打开、是否减少反复回想、是否发生高后果遗漏、是否值得保持无账号/Local-first 边界。

## 最终证据入口

- [`requirements-matrix.md`](requirements-matrix.md)
- [`pwa/g3-deployment-2026-08-30.md`](pwa/g3-deployment-2026-08-30.md)
- [`pwa/g3-full-v1-2026-08-30.md`](pwa/g3-full-v1-2026-08-30.md)
- [`wechat/g5-full-v1-2026-08-30.md`](wechat/g5-full-v1-2026-08-30.md)
- [`wechat/g5-semantic-audit-2026-08-31.md`](wechat/g5-semantic-audit-2026-08-31.md)
- [`wechat/ui-restoration-2026-08-31/design-qa.md`](wechat/ui-restoration-2026-08-31/design-qa.md)
- [`wechat/ui-restoration-2026-08-31/tool-results.md`](wechat/ui-restoration-2026-08-31/tool-results.md)
- [`wechat/secondary-pages-android-2026-09-01/audit.md`](wechat/secondary-pages-android-2026-09-01/audit.md)
- [`codex-cloud-smoke-2026-08-31.md`](codex-cloud-smoke-2026-08-31.md)
- [`wechat/ui-audit-2026-08-31/audit.md`](wechat/ui-audit-2026-08-31/audit.md)
- [`../docs/deployment/pwa.md`](../docs/deployment/pwa.md)
- [`../docs/deployment/wechat.md`](../docs/deployment/wechat.md)
- [`../docs/deployment/codex-cloud.md`](../docs/deployment/codex-cloud.md)
