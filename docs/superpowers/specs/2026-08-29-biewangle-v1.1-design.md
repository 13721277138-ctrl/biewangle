# 别忘了 V1.1 双端实现设计

> 本设计只把已经冻结的 V1.1 产品主源翻译为工程边界，不新增产品规则。若本文件与 `docs/01_别忘了_产品定义与冻结规格_V1.1.md`、`docs/02_别忘了_官方模板内容库_V1.1.md` 或 `docs/03_Codex_别忘了_双端开发_任务书_V1.1.md` 冲突，以三份正式主源的权威顺序为准。

## 1. 交付范围

仓库交付两个独立界面实现：

- `pwa/`：React + TypeScript + Vite 的 mobile-first PWA，Mac 管理视图增强；
- `miniprogram/`：微信原生 WXML/WXSS/JavaScript 小程序，不嵌网页、不复制 PWA 导航；
- `packages/domain/`：不依赖 DOM、浏览器或微信 API 的纯领域合同；
- `shared-content/`：由正式 Markdown 主源确定性生成的官方内容资产；
- `tests/conformance/`：两端适配器对同一 Golden Fixtures 的行为合规测试。

两端不共享 UI 代码。纯领域规则、正式内容和合规用例只定义一次，避免两端分别解释状态机。

## 2. 领域边界

领域包负责且只负责：

- OfficialTemplate、PersonalTemplate、PlannedCheck、CheckRun、CheckRunItem、AppSettings 与 BackupEnvelope 的可执行 Schema；
- PlannedCheck `pending → consumed | canceled`；
- CheckRun `inProgress → completed | endedWithUnresolved | discarded` 及窗口内重开事件；
- 模板快照、计划快照、Run 快照；
- 完成真实性、关键项风险、closedEvents、staleCandidate 派生值；
- 首页继续检查/接下来排序、搜索排序、分享投影；
- 备份解析、业务校验、Schema migration 和重置保护副本；
- 领域操作的纯函数与可序列化结果。

页面不得直接改写核心 `status`。页面提交领域命令，持久化适配器 durable write 成功后才公布最终状态；失败返回可见错误并保留 durable truth。

## 3. 数据与持久化

### PWA

- IndexedDB 通过 Dexie 管理；一个 `AppSnapshot` 写入事务同时更新实体与元数据。
- 每次用户核心操作先计算下一快照，再开启事务；事务失败时 UI 保持/恢复到已提交快照并显示“未保存，请重试”。
- migration 先从旧库读取保护快照，在内存临时区迁移并执行完整业务校验，通过后才提交新 Schema。
- `navigator.storage.persisted()` 与 `persist()` 只做能力探测和低打扰请求；结果显示在数据页，绝不称为备份。
- Service Worker 使用提示式更新：有活跃 Run 时不执行强制 `skipWaiting + reload`；新版本可在用户离开核心检查后激活。
- 数据库写入带 `schemaVersion` 与 `minimumWriterVersion`；旧客户端发现不可写版本后转为只读并要求刷新，防止不兼容并发写。

### 微信

- 使用 `wx.setStorage` 异步写入，禁止把同步 API 当成用户操作成功条件。
- 采用双槽快照：先写非活跃槽、读回并校验，再原子切换 active pointer；失败保留旧槽并向页面返回错误。
- 10 MB 官方本地缓存上限作为能力边界；备份文件与可读文本不依赖长期缓存无限增长。
- 导入文件先进入临时区，完整解析/Schema/业务校验后才切换正式快照。

## 4. Backup Envelope

固定最小头部：

```ts
interface BackupEnvelope {
  productId: "biewangle";
  appVersion: string;
  schemaVersion: number;
  backupFormatVersion: number;
  sourcePlatform: "pwa" | "wechat";
  officialContentVersion: number;
  exportedAt: string;
  data: AppSnapshot;
}
```

恢复顺序为“当前保护副本 → 临时解析 → 版本检查 → Schema 检查 → 领域不变量检查 → 原子提交”。损坏 JSON、错误 productId、未来 backupFormatVersion、不可支持高 Schema 或业务不变量失败都不改变当前正式数据。

## 5. 官方内容流水线

`docs/02_别忘了_官方模板内容库_V1.1.md` 是唯一人类内容主源。`scripts/compile-official-templates.ts` 解析固定标题、元数据和表格语法，生成排序稳定、缩进固定的 `shared-content/official-templates.v1.1.json`。CI 执行编译后与已提交资产逐字节比较，并验证：

- 13 张模板、244 项、7 个不重复精选序号；
- templateId 唯一、模板内 groupId 唯一、itemId 全局唯一；
- 文案、condition、hint、顺序、版本和别名与 Markdown 一致；
- 初始开发包 JSON 与生成资产一致。

## 6. PWA 信息架构

路由保持核心任务深度不超过两层：

- `/`：继续检查、接下来、我的常用、官方精选、搜索/新建入口；
- `/runs`、`/runs/:id`：全部进行中与具体 Run；
- `/plans`、`/plans/new`：全部计划与创建计划；
- `/templates`、`/templates/:id`、`/templates/new`、`/templates/:id/edit`：官方/个人模板浏览管理；
- `/search`：本地可解释搜索；
- `/history`、`/history/:id`：CheckRun + closedEvents 只读投影；
- `/data`：保护状态、JSON 备份/恢复、可读导出、重置；
- `/settings`：集中产品参数展示和低频设置。

直接点击模板立即创建 Run。模板详情用于管理和计划，不成为启动前确认门。

## 7. 微信信息架构

原生页面数量克制：

- `pages/home`：继续、接下来、常用与精选；
- `pages/run`：核心检查；
- `pages/more-runs` 与 `pages/plans`：其余进行中与计划；
- `pages/templates`、`pages/template-edit`：模板浏览/个人模板编辑；
- `pages/history`、`pages/history-detail`：历史；
- `pages/data`：备份、恢复、复制与保护边界；
- `pages/search`：搜索。

分享用 `onShareAppMessage`、`wx.shareFileMessage` 或 `wx.setClipboardData`；不伪装长期在线个人模板链接。系统日历用 `wx.addPhoneCalendar` 且明确请求授权。订阅消息因需要模板 ID、账号后台和发送端，标记 `requires-backend`，不纳入 V1 核心。

## 8. 视觉系统

视觉基准：`docs/design/visual-concept-v1.1.png`。生成图只定义视觉关系，不定义产品内容；图中的非正式模板名、数量、日期和不允许的官方删除动作均不得进入实现。

### 颜色

- `--color-bg: #F7F7F3`：暖白页面背景；
- `--color-surface: #FFFFFF`：主要内容面；
- `--color-ink: #17201E`：正文；
- `--color-muted: #66716E`：次要文本，保持 WCAG 对比；
- `--color-primary: #247463` / `--color-primary-strong: #185C4E`；
- `--color-border: #DDE3DF`；
- `--color-warning: #B85E42`：只用于关键未确认、破坏性确认和失败；
- `--color-success-soft: #E7F1ED`。

### 尺寸与组件

- 系统中文字体栈，不加载远程字体；
- 8px 基础间距，页面横向 gutter：手机 16px、桌面 28px；
- 触控目标最小 44×44px；
- 控件圆角 12px，主要容器 16px；
- 卡片只用于真实聚合信息；普通列表使用开放式分隔行；
- 三状态同时有图形、文字、可访问名称；主点击只切换 unchecked/confirmed；
- `notNeeded` 为独立次级动作，不使用三态循环；
- 风险不使用满屏红色；完成不使用夸张庆祝。

### 响应式

- 375px 与 390px 首要；支持 iPhone 安全区，无底部遮挡和横向溢出；
- ≥960px 切换桌面 shell：左侧导航、主列表、可选详情列；
- Mac 模板、历史和数据页使用并排主从布局，不是手机页面拉宽。

## 9. 错误与信任表达

- durable write 失败：保留真实状态，显示“未保存，请重试”；
- Run 有 unchecked：正常完成动作不可用，但“结束本次检查”仍可进入 unresolved；
- 未确认关键项：必须显示数量并二次确认；
- 恢复失败：说明原因并明确“当前数据未改变”；
- 持久存储拒绝：说明“当前仍可使用，完整备份更可靠”；
- 平台能力缺失：显示真实降级方式，不显示“已设置成功”。

## 10. 安全、隐私与可访问性

- 所有用户文本按纯文本渲染，禁止 `dangerouslySetInnerHTML` 和 WXML 富文本注入；
- 导入文件设 10 MB 应用层上限，先验证再解析进入正式区；
- 前端不保存服务端密钥，不引入 Analytics、广告、远程字体和非必要 CDN；
- 分享预览默认排除 `oneTimeNote` 与未选择历史状态；
- 键盘、焦点、屏幕阅读器名称、语义标题和 reduced motion 纳入自动验收；
- 颜色从不作为唯一状态信息。

## 11. 发布与证据

- PWA 构建为纯静态 HTTPS 站点；首选与 GitHub 远端关联后自动部署，若账号授权未完成则保留可直接上传的 `pwa/dist` 与本地 HTTPS/HTTP 实测证据。
- 微信工程先完成静态配置与 Node 合规测试，再使用官方开发者工具编译、预览、体验版和审核链；AppID、扫码与管理员点击只在真实阻塞点请求用户。
- 每个 P0/P1 Requirement 必须链接自动测试或真实终端证据；未在当前设备真实执行的终端形态明确标记 blocked，而不是推定通过。

## 12. 自检结论

- 没有改变 V1.1 状态机、内容身份、提醒梯度或双端独立数据岛边界；
- 没有引入账号、云同步、AI、社区、远程 Analytics 或复杂提醒后端；
- 架构按 G0 → G1 → G2 → G3 → G4 → G5 → G6 顺序可分阶段验证；
- 正式主源、派生资产、平台实现与证据包边界清楚；
- 当前范围可由一份实施计划连续完成。

