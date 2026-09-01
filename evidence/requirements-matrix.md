# V1.1 P0 / P1 与 26 项最低不变量证据矩阵

更新日期：2026-09-01（Asia/Shanghai）

本文件只把本轮真实执行过的命令、浏览器、微信开发者工具或已留存终端证据标为已验证。状态词：

- `verified`：自动合同与适用的当前终端证据均已通过；
- `verified-degraded`：核心语义已通过，平台能力按冻结规格诚实降级；
- `partial-external`：代码/自动化或模拟器已通过，但指定物理终端仍需用户动作；
- `blocked-external`：当前设备、账号、主体或平台权限不具备，未推定通过。

## 新鲜全仓门禁

2026-09-01 在 Node.js 24、pnpm 11.19.0 本地工作树从冻结锁文件实际执行：

```text
pnpm runtime:check             PASS（Node.js 24 / pnpm 11.19.0）
pnpm install --frozen-lockfile  PASS（Already up to date）
pnpm content:check              PASS（Markdown = shared JSON = 微信派生 JS）
pnpm lint                       PASS
pnpm typecheck                  PASS
pnpm test                       PASS（31 files, 158 tests）
pnpm build                      PASS（35 precache entries, 573.51 KiB）
pnpm verify:boundaries          PASS（41 authored files, 40 production files）
pnpm miniprogram:verify         PASS（11 pages, 13 templates, 247764 bytes）
pnpm e2e                        PASS（8 / 8）
git diff --check                PASS
```

## A 类 P0：产品不可降级硬门

| Requirement | PWA | 微信 | 自动测试 / 合同 | 真实终端证据 | 状态 |
|---|---|---|---|---|---|
| A-001 Run 状态真实性 | 三状态、关闭回执与 History 均从已落盘 Run 投影 | shared/native 关闭链、回执和 History 投影一致 | `packages/domain/test/run.test.ts`、`packages/domain/test/backup.test.ts`、`tests/conformance/miniprogram-contract.test.ts` | 公网 PWA 完整 E2E；微信官方模拟器完成/未确认/放弃三种历史事实 | `verified` |
| A-002 Planned Snapshot / Run Snapshot 稳定 | 计划与 Run 使用冻结快照 | 原生服务使用同结构冻结事实，恢复时深度核对计划/Run 链接 | `[PLAN-001]`、`[RUN-002]`、native conformance、backup business invariants | PWA 完整链与微信官方模拟器均实际创建、恢复冻结 Run | `verified` |
| A-003 `notNeeded` 不继承 | 状态仅写本次 Run item | 同模板新 Run 从冻结模板生成全新 unchecked item | `[RUN-001]`、PWA vertical slice、微信 vertical slice | 公网 PWA E2E与微信模拟器均实际操作本次不需要 | `verified` |
| A-004 未处理不能伪 `completed` | 正常完成被领域层拒绝，关键项过滤不改变总计数 | 原生关闭前使用同一计数与二次确认语义 | `[RUN-003]`、`[RUN-004]`、`[RUN-007]`、closure receipt conformance | 公网 PWA真实结束链；微信模拟器历史真值截图 | `verified` |
| A-005 持久化失败不得静默成功 | IndexedDB 事务失败时回滚 UI 并显示未保存 | 双槽 commit 失败不推进 service 内存事实 | `[DATA-001]`、`pwa/src/app/App.test.tsx`、`pwa/src/data/durable-store.test.ts`、`tests/miniprogram/vertical-slice.test.ts` | 失败注入为开发测试终端；不能在生产中破坏真实用户数据复现 | `verified` |
| A-006 迁移 / 恢复失败不破坏原数据 | 先保护、临时解析、全校验、原子替换 | 恢复前保护副本，双槽指针与候选快照均校验 | `[DATA-002..005]`、migration tests、PWA FullV1、微信 full-v1/store tests | PWA 完整 E2E实际损坏恢复失败后再有效恢复；微信模拟器实际备份/清空/恢复 | `verified` |
| A-007 官方模板稳定 ID 与内容身份 | Markdown 确定性派生 13 模板、244 item，官方原件只读 | 使用同一派生主源和 `official.*` 身份 | content compiler/check、`[TPL-001..003]`、微信 full-v1 | PWA 与微信均实际浏览全部模板入口；内容门本轮重跑 | `verified` |
| A-008 双端领域合同一致 | shared domain 是 PWA 业务合同 | native domain 对代表 fixtures、备份、严格 schema、回执做差分 | 27 个 Golden Cases；`tests/conformance/domain-contract.test.ts` 与 `miniprogram-contract.test.ts` | 微信官方编译/模拟器/体验构建建立 native 终端证据 | `verified` |
| A-009 Local-first 与无自动同步事实透明 | IndexedDB、本地导出，数据页解释持久性边界 | 微信本地双槽、数据页解释备份边界 | runtime-boundary 与 miniprogram verifier 禁止网络/云/追踪/密钥 | 公网端点可离线；微信体验包为无网络原生工程 | `verified` |

A 类 9 项全部有当前运行证据，未以 README、build 或工具“能打开”代替。

## B 类 P1：平台 V1 体验硬门

| Requirement | PWA | 微信 | 自动测试 / 合同 | 真实终端证据 | 状态 |
|---|---|---|---|---|---|
| B-001 手机单手核心检查 | 375/390 px 无横向溢出，触控目标与底部导航通过 | 原生短路径首页→Run；iOS、HarmonyOS、Android 默认字体模拟器通过；Android 其余 7 页逐页复验 | responsive E2E、PWA vertical slice、微信 full-v1、视觉整改与次级页面审计 | Chrome 手机视口与微信官方模拟器已验证；物理手机完整 Run 尚无人工记录 | `partial-external` |
| B-002 PWA Offline-first Core | Service Worker 预缓存 + IndexedDB 冷启动 | 不适用 | `pwa/e2e/offline.spec.ts`、生产构建 | 公网 HTTPS 完整断网冷启动通过 | `verified` |
| B-003 微信原生核心体验 | 不适用 | 11 个原生页面、无 `web-view`、13 模板完整链；模板编辑展示标签与存储 token 分离 | miniprogram verifier、微信 full-v1、native conformance、template-edit page test | 官方逐页编译、模拟器业务闭环、iOS/HarmonyOS/Android 视觉复验、Android 次级 7 页复验、手机自动预览推送、测试号 `1.1.0` 体验构建上传 | `partial-external`（物理手机完整走查待用户） |
| B-004 PWA 安装形态 | manifest、图标、standalone、SW 与安装性无错误 | 不适用 | build + offline/installability 检查 | 公网 Chrome CDP 安装性通过；iPhone 主屏和 Mac Add to Dock 未真实点击，当前 Mac 为 macOS 13.3.1 | `partial-external` |
| B-005 备份 / 导出 | JSON、Markdown、10 MB 导入、保护恢复/重置 | JSON、可读文本、聊天文件导入/分享适配 | DATA contracts、readable export、双端 FullV1 | PWA 公网 E2E；微信官方模拟器备份/清空/恢复 | `verified` |
| B-006 基础可访问性 | WCAG A/AA、键盘焦点、reduced motion、非颜色唯一状态 | 原生文案与控件不只依赖颜色；无独立屏幕阅读器实测 | `pwa/e2e/accessibility.spec.ts`、静态边界 | 公网 PWA axe/键盘通过；微信屏幕阅读器真机待补 | `partial-external` |
| B-007 平台内可靠分享 | Web Share feature detect；失败回退剪贴板/下载 | `onShareAppMessage`、clipboard、`shareFileMessage` 原生适配 | `[SHARE-001..002]`、native platform/share tests | API 与模拟器入口已验证；系统分享面板/聊天文件发送必须由真实用户手势完成 | `verified-degraded` |
| B-008 真机验证 | 公网真实浏览器已验证；iPhone 主屏、Safari Add to Dock 未完成 | 官方工具与体验构建已到位，物理微信完整回归未留证 | 自动化不能替代本项 | 见下方终端形态与外部阻塞 | `blocked-external` |

## 26 项关键不变量逐条映射

| # | 不变量 | 可检查自动证据 | PWA / 微信适用证据 | 状态 |
|---:|---|---|---|---|
| 1 | Run 不污染 Template | `[RUN-001]` | PWA/微信 vertical slice；native FullV1 官方源 byte-stable | `verified` |
| 2 | `notNeeded` 不跨 Run | `[RUN-001]` | shared/native 状态差分；双端纵切 | `verified` |
| 3 | Run 启动后模板修改不改变本次 | `[RUN-002]` | PWA shared domain；native snapshot conformance | `verified` |
| 4 | Planned Check 创建后模板修改不改变计划快照 | `[PLAN-001]` | PWA 计划 UI；native frozen plan vertical slice | `verified` |
| 5 | 官方升级不改变既有计划 | `[PLAN-001]` 明确构造 official v2 | 同一 frozen snapshot 启动 Run | `verified` |
| 6 | unchecked 存在时不能 completed | `[RUN-003]` | 双端关闭投影和回执差分 | `verified` |
| 7 | key unchecked 结束经过二次确认 | `[RUN-004]` | PWA E2E；微信关闭服务与页面 | `verified` |
| 8 | key-only 视图不制造假完成 | `[RUN-007]` | PWA Run 过滤；微信 Run 过滤 | `verified` |
| 9 | 重开保留此前关闭事件 | `[RUN-005]`、backup close-lineage tests | PWA FullV1；微信 History detail | `verified` |
| 10 | 重开窗口后旧 Run 不可直接改写 | `[RUN-006]` | 历史重新开始生成不同 ID | `verified` |
| 11 | 同模板多 Run 不自动合并 | `[RUN-008]` | PWA FullV1；微信 more-runs/full-v1 | `verified` |
| 12 | 写入失败不静默成功 | `[DATA-001]`、PWA durable store/App、微信 vertical slice | 双端 failure injection 后 durable truth 不变 | `verified` |
| 13 | 个人模板软删除可恢复 | `[TPL-003]` | PWA FullV1；微信 FullV1 | `verified` |
| 14 | 官方模板不受个人删除影响 | `[TPL-003]` 深度核对 official 源 | 双端个人生命周期测试 | `verified` |
| 15 | 官方升级不覆盖个人模板 | `[TPL-002]` | derived metadata 仅解释来源 | `verified` |
| 16 | 恢复失败不破坏当前数据 | `[DATA-002]` | PWA FullV1/E2E；微信 FullV1/store | `verified` |
| 17 | migration 失败不破坏旧数据 | `[DATA-004]`、migration failure cases | 持久化合同先保护后迁移；native 当前 schema 拒绝未知版本 | `verified` |
| 18 | 未知未来 `backupFormatVersion` 拒绝 | `[DATA-003]` | PWA persistence；微信 FullV1 | `verified` |
| 19 | 日期级计划不因时区变化漂移 | `[PLAN-003]` | 字面 `YYYY-MM-DD` 跨端合同；native platform 校验 | `verified` |
| 20 | consumed / canceled 计划不继续提醒 | `[PLAN-002]`、`[PLAN-004]` 均断言无 future/reminder | PWA/微信计划投影只取 pending | `verified` |
| 21 | 分享清单默认不包含 `oneTimeNote` | `[SHARE-001]`、微信 vertical slice/readable export | 双端分享预览默认排除 | `verified` |
| 22 | 搜索三个固定 case 通过 | `[SEARCH-001..003]` | PWA 搜索；微信 FullV1 literal weighted results | `verified` |
| 23 | 首页排序在相同输入下确定 | `[HOME-001..002]` | 稳定 tie-breaker 到 `checkRunId` | `verified` |
| 24 | 模板 ID / itemId 永不重复 | official content identity test | 13 templateId、244 itemId、组内 groupId 唯一；两端派生内容一致 | `verified` |
| 25 | PWA 离线冷启动通过 | `pwa/e2e/offline.spec.ts` | 本地与公网 HTTPS 均实际断网重载并恢复 IndexedDB Run | `verified` |
| 26 | schema 变化版本不发生不兼容并发写损坏 | persistence contract `assertWriterCompatible`；PWA repository 调用；微信 store/schema rejection | 旧 writer 在 commit 前只读停止；native 非法候选不写槽、不切指针 | `verified` |

上述 `[RUN-*]`、`[PLAN-*]`、`[TPL-*]`、`[DATA-*]`、`[SHARE-*]`、`[SEARCH-*]`、`[HOME-*]` 均来自 `contracts/domain-contract-cases.v1.1.json` 或对应可执行测试；`tests/conformance/domain-contract.test.ts` 会拒绝未映射的冻结合同。

## 真实终端与能力边界

| 终端 / 阶段 | 当前事实 | 状态 | 证据 |
|---|---|---|---|
| PWA 公网普通浏览器 | GitHub Pages HTTPS、完整 E2E、离线冷启动、深链恢复 | `verified` | `evidence/pwa/g3-deployment-2026-08-30.md` |
| PWA 375/390 手机形态 | Chrome 真实渲染与触控/溢出自动检查 | `verified`（形态） | `evidence/pwa/g3-full-v1-2026-08-30.md` |
| iPhone/iPad 主屏 Web App | 当前没有可检查的真实设备操作记录 | `blocked-external` | 需要用户设备 |
| Mac Safari 普通网页 | 当前 G6 未形成独立 Safari 操作记录 | `blocked-external` | 需要用户终端操作 |
| Mac Add to Dock | 当前 macOS 13.3.1 低于 Sonoma 14 | `blocked-external` | `evidence/g0/platform-capability-matrix-2026-08-29.md` |
| 微信开发者工具 | 11 页官方编译、真实模拟器业务闭环；iOS/HarmonyOS/Android 核心页与 Android 次级 7 页默认字体视觉复验通过 | `verified` | `evidence/wechat/secondary-pages-android-2026-09-01/audit.md` |
| 微信手机预览 | 次级页面修复后 `190070 bytes` 自动预览已推送到当前开发者微信，未伪造手机完整走查 | `partial-external` | `evidence/wechat/secondary-pages-android-2026-09-01/audit.md` |
| 微信体验构建 | 测试号 `1.1.0` 在次级 7 页复验与模板标签修复后上传成功，包体 `190569 bytes` | `verified` | `evidence/wechat/secondary-pages-android-2026-09-01/audit.md` |
| 微信正式审核 / 发布 | 无正式主体、生产 AppID 与审核发布权限 | `blocked-external` | 需要账号所有者 |

## 证据入口

- PWA 完整 V1：[`pwa/g3-full-v1-2026-08-30.md`](pwa/g3-full-v1-2026-08-30.md)
- PWA 公网部署：[`pwa/g3-deployment-2026-08-30.md`](pwa/g3-deployment-2026-08-30.md)
- 微信完整 V1：[`wechat/g5-full-v1-2026-08-30.md`](wechat/g5-full-v1-2026-08-30.md)
- 微信数据语义专项：[`wechat/g5-semantic-audit-2026-08-31.md`](wechat/g5-semantic-audit-2026-08-31.md)
- 微信视觉整改复验：[`wechat/ui-restoration-2026-08-31/design-qa.md`](wechat/ui-restoration-2026-08-31/design-qa.md)
- 微信视觉整改工具事实：[`wechat/ui-restoration-2026-08-31/tool-results.md`](wechat/ui-restoration-2026-08-31/tool-results.md)
- 微信 Android 次级 7 页审计与修复：[`wechat/secondary-pages-android-2026-09-01/audit.md`](wechat/secondary-pages-android-2026-09-01/audit.md)
- 平台能力矩阵：[`g0/platform-capability-matrix-2026-08-29.md`](g0/platform-capability-matrix-2026-08-29.md)
- 最终交付状态：[`final-delivery-report.md`](final-delivery-report.md)

## GitHub / Codex Cloud 复现状态

- 视觉整改检查点 `dfe96f9` 的开发分支 CI `33454860954`：success；
- 同一检查点的 `main` CI `33454980793`：success；
- 同一检查点的 `main` Pages build/deploy `33454980752`：success；
- branch verify、main verify、Pages build、Pages deploy 四个 check-run annotation 均为 0；
- 最新公网完整 E2E：8/8；
- 默认分支包含 `AGENTS.md`、lockfile、CI、复现与证据文档；
- Codex Cloud 已关联仓库并创建 `biewangle-v1.1-node24` 环境；首次只读完整门禁任务为 `READY / no diff`，证据见 `evidence/codex-cloud-smoke-2026-08-31.md`。本轮视觉提交仍以 GitHub CI 和本地新鲜门禁为准，不把旧 Cloud 烟测外推为新提交已在 Cloud 重跑。

未完成的 B 类真实终端动作会继续保留 `partial-external` / `blocked-external`，不因 26 项自动不变量全绿而改写为“全终端完成”。
