# Codex_别忘了_双端开发_任务书_V1.1

> **执行对象：** Codex  
> **任务性质：** 真实执行，不是方案咨询  
> **产品：** 别忘了  
> **目标：** 按V1.1正式主源实际完成PWA＋微信小程序两个高质量V1，并推进到当前环境与账号权限允许的最远真实交付状态。  
> **最高原则：** 用户不可替代的动作才交给用户；Codex能执行的，不提前甩回用户。

## 0、先确认正式主源与权威链

开始前完整读取：

1. `docs/01_别忘了_产品定义与冻结规格_V1.1.md`
2. `docs/02_别忘了_官方模板内容库_V1.1.md`
3. 本任务书
4. `contracts/official-templates.v1.1.json`
5. `contracts/domain-contract-cases.v1.1.json`
6. `evidence/守一_别忘了_V1产品策划_80问决策备案_V1.0.md`仅在需要追溯形成原因时读取

发生冲突时：

> **产品行为、范围、信任边界：产品规格优先**  
> **官方模板正文与内容身份：官方模板内容库优先**  
> **工程执行、测试、部署方式：本任务书优先，但不得反向创造产品规则**  
> **JSON / contract是派生可执行资产，不得反向覆盖Markdown正式主源**  
> **80问只解释形成史，不得覆盖V1.1**

若发现派生JSON与Markdown不一致：

> 停止使用错误派生物 → 以Markdown主源重新确定性生成 → 加测试防止再次漂移。

不要再向用户重新询问已经冻结的产品决策。

## 一、完成的定义

必须真实执行：

> **检查环境 → 风险尖峰 → 建立领域合同 → 开发 → 运行 → 自动测试 → 浏览器 / 真机验证 → 修复 → 构建 → 部署 → 再验证 → 形成证据包。**

禁止把以下单独视为完成：

- 代码存在；
- build成功；
- 截图好看；
- Lighthouse高分；
- “理论上支持离线”；
- “理论上能恢复”；
- 微信开发者工具编译成功；
- README写了发布方法；
- 只给用户一堆后续手工步骤。

只有真正无法替代的人类动作，例如：

- 登录 / 扫码；
- 小程序AppID / 主体权限；
- 外部云平台授权；
- 管理员确认；
- 当前设备上的真机操作；
- 审核 / 发布按钮必须由账号管理员完成；

才把**最小一步**交给用户。用户完成后继续推进。

## 二、要求分级

### A｜产品不可降级硬门

任何平台不得降级：

- Run状态真实性；
- Planned Snapshot与Run Snapshot稳定；
- `notNeeded`不继承；
- 未处理不能伪completed；
- 持久化失败不得静默成功；
- 数据迁移、恢复失败不得破坏原数据；
- 官方模板稳定ID与内容身份；
- 双端领域合同一致；
- Local-first与无自动同步事实透明。

### B｜平台V1体验硬门

- 手机单手核心检查；
- Offline-first Core（PWA）；
- 微信原生核心体验；
- PWA安装形态；
- 备份 / 导出；
- 基础可访问性；
- 平台内可靠分享；
- 真机验证。

### C｜实现质量默认

可以选择更优稳定方案替代：

- React / TypeScript / Vite；
- IndexedDB封装；
- 状态管理库；
- 测试框架；
- 目录结构；
- 小程序具体工程框架。

替代必须更简单或更可靠，并不得破坏A / B。

### D｜外部条件依赖

只有这类允许形成最终外部阻塞：

- AppID；
- 微信主体 / 管理员权限；
- 发布账号；
- 第三方托管登录授权；
- 域名 / 备案 / 审核；
- 平台当前能力本身不支持。

## 三、工程总战略

### 1、统一行为，不追求统一代码

> **统一产品，不统一代码；统一行为契约，不统一界面实现。**

允许：

- PWA与微信完全独立工程；
- 0% UI代码共享；
- 共享内容JSON、领域fixture或测试数据；
- 两端使用不同导航、分享、提醒和导出方式。

禁止：

- 为了代码复用把微信做成网页翻版；
- 为了“功能一致”伪装平台做不到的能力；
- 两端各自重新解释状态机。

### 2、推荐仓库

```text
biewangle/
  pwa/
  miniprogram/
  contracts/
  shared-content/
  tests/
    conformance/
  scripts/
  docs/
  evidence/
```

可以调整，但必须保持“正式主源 → 派生合同 → 平台实现”的边界。

### 3、运行时依赖边界

核心运行时不得依赖：

- Google Fonts或其他远程字体；
- 第三方CDN才能启动；
- 远程Analytics；
- 广告SDK；
- 非必要远程错误追踪；
- 任何会破坏Offline-first或中国大陆基础可用性的非必要外部服务。

构建依赖可以来自正常包管理生态。

## 四、执行顺序：不要同时铺满两个错误工程

### G0｜平台能力与风险尖峰

正式大规模UI前，以最小代码核验。

#### PWA

核验：

- manifest / 安装；
- iOS主屏Web App；
- Mac Safari Add to Dock；
- IndexedDB或等价存储；
- `navigator.storage.persisted()` / `persist()`支持与实际结果；
- Service Worker离线冷启动；
- Service Worker更新时不中断活跃Run；
- schema变化时避免旧client / 新client不兼容并发写；
- 文件导入 / 导出；
- Web Share降级；
- 当前可实现的系统级提醒能力。

#### 微信

必须以**实施当天微信官方开发文档＋当前账号后台**核验：

- 本地持久化；
- 文件选择 / 导入 / 导出；
- 分享；
- 订阅消息；
- 系统日历或等价入口；
- 更新机制；
- AppID、真机预览、体验版、审核与发布权限。

输出一张短能力矩阵：

```text
supported
degraded
blocked
requires-backend
requires-user-action
```

提醒特别注意：

> V1核心只保证L0应用内计划提示；系统日历是优先增强；Web Push / 微信订阅消息只有当前能力与基础设施可靠时实现，不得为了“提醒”偷偷引入未冻结的账号 / 云同步架构。

G0只做技术事实验证，不重开产品决策。

### G1｜先建立可执行领域合同

在完整页面开发前完成：

1. 正式TypeScript / 等价Schema；
2. Check Run状态转换函数；
3. Planned Check生命周期；
4. Planned Snapshot → Run Snapshot；
5. Backup Envelope；
6. migration framework；
7. 首页排序函数；
8. 搜索排序函数；
9. 模板Markdown → JSON确定性编译 / 校验脚本；
10. `contracts/domain-contract-cases.v1.1.json`合规测试；
11. 官方模板完整性测试。

**G1未通过，不进入双端大规模页面开发。**

### G2｜PWA纵向切片

先用4张代表模板跑完整链路：

1. `official.daily_out`：短清单；
2. `official.hotel_checkout`：空间扫描；
3. `official.international_travel`：长清单＋分组；
4. `official.important_medical_visit`：高后果信息型场景。

纵向切片必须覆盖：

> 模板 → 直接开始 / 创建计划 → Planned Snapshot → Run Snapshot → 三状态 → 临时项 → oneTimeNote → 排序 → 中断恢复 → 正常完成 / unresolved结束 → 重开 → History视图 → 备份恢复 → 离线冷启动。

纵切不通过，不导入全部页面和全部模板。

### G3｜PWA完整V1＋真实公网部署

纵切通过后完成：

- 全13模板；
- 模板管理；
- 计划；
- 搜索；
- 历史；
- 数据与备份；
- 设置；
- 分享；
- 可访问性；
- 安装形态；
- 更新 / migration；
- 真实公网部署；
- 部署URL上重新跑关键验收。

### G4｜微信纵向切片

使用与PWA相同4张代表模板、相同领域fixture，证明：

- 状态语义一致；
- Planned Snapshot / Run Snapshot一致；
- 本地持久化可靠；
- 中断恢复；
- 分享采用微信原生最佳方式；
- 平台能力降级不伪装；
- Backup Envelope语义一致。

### G5｜微信完整V1＋最远真实发布链

再扩：

> 全13模板 → 全页面 → 真机 → 体验版 → 审核前检查 → 当前权限允许时继续提交 / 发布。

### G6｜证据式总验收

未完成A类硬门，不得声明产品完成。

## 五、正式领域模型

以产品规格为准。实现必须清楚区分：

- OfficialTemplate
- PersonalTemplate
- PlannedCheck
- CheckRun
- CheckRunItem
- AppSettings
- SoftDeletedPersonalTemplate
- BackupEnvelope

History默认实现为：

> **CheckRun＋append-only closedEvents的只读投影。**

不要另外创建一个会和CheckRun互相覆盖的可变History真相源。

如果为了查询性能物化历史缓存：

> 必须可从CheckRun事实重建，并写一致性测试。

## 六、核心状态机

### PlannedCheck

```text
pending → consumed
pending → canceled
```

提前开始：

> pending → consumed

### CheckRun

```text
inProgress → completed
inProgress → endedWithUnresolved
inProgress → discarded
completed / endedWithUnresolved → inProgress   # reopen event，限定窗口内
```

`reopened`不是状态。  
`staleCandidate`不是状态。  
`deleted`不是状态。  
`planned`不是CheckRun状态。

必须集中实现状态转换，不允许页面组件自己散落改status。

## 七、持久化合同

每次核心操作：

1. 产生领域操作；
2. 进入持久化；
3. durable write成功；
4. UI确认最终状态。

允许乐观UI，但失败必须：

- 回滚；或
- 明确显示未保存并禁止用户误以为已经可靠完成。

必须测试：

- IndexedDB事务失败；
- 容量 / quota异常（可模拟）；
- 数据库打开失败；
- 写入中断；
- 冷启动恢复；
- 私密 / 特殊浏览环境可行性（能测试则测试，不能则明确能力边界）。

## 八、PWA本地数据可靠性

优先使用成熟IndexedDB封装或同等级可靠方案。

支持时：

- 检查`navigator.storage.persisted()`；
- 在不打断核心任务的合适时机请求`navigator.storage.persist()`；
- 被拒绝正常使用；
- 数据页展示“本地数据保护状态 / 最近备份时间”；
- 有真实个人资产后可低打扰提示一次备份，不反复骚扰。

必须明确：

> persistent storage不是备份。

## 九、Backup Envelope

至少：

```ts
{
  productId: "biewangle";
  appVersion: string;
  schemaVersion: number;
  backupFormatVersion: number;
  sourcePlatform: "pwa" | "wechat";
  officialContentVersion: number;
  exportedAt: string;
  data: unknown;
}
```

恢复必须：

> 保护当前数据 → 临时区解析 → schema校验 → 业务不变量校验 → 全部通过 → 原子提交。

必须拒绝：

- 损坏JSON；
- productId不匹配；
- 未知未来backupFormatVersion；
- 不支持的高版本schema。

任何失败：

> 当前正式数据不变。

V1不做智能合并。

## 十、schema升级与版本并发

正式版本升级必须：

> 保护 → migrate → validate → commit

同时处理多client风险：

- 旧Safari标签；
- 已安装PWA窗口；
- 新版本Service Worker；
- 新schema。

冻结结果要求：

> **旧客户端与新schema不得在不兼容状态下并发写而造成数据损坏。**

具体采用升级锁、版本协调、兼容写入或等待旧client退出，由Codex选择最简单可靠方案。

禁止无条件：

```text
skipWaiting + reload
```

打断活跃Check Run。

## 十一、官方模板编译与完整性

`docs/02_别忘了_官方模板内容库_V1.1.md`是唯一内容主源。

仓库内`shared-content/official-templates.v1.1.json`必须由它**确定性生成或严格校验**。

本开发包已附：

> `contracts/official-templates.v1.1.json`

它只是初始派生资产。Codex第一阶段必须建立脚本，证明后续可以从Markdown主源稳定生成 / 校验，而不是永久手工维护两份。

至少检查：

- 13张模板；
- templateId唯一；
- groupId在模板内唯一；
- itemId全局唯一；
- contentVersion；
- title；
- applicability；
- group顺序；
- item顺序；
- importance；
- condition；
- hint；
- searchAliases；
- featuredOrder 1—7完整且不重复；
- Markdown与JSON一致。

Codex不得自行“优化”官方模板文字。

若发现明显笔误：

> 记录问题，不直接以模型判断改写正式内容主源。

## 十二、搜索

本地、可解释。

权重：

1. title；
2. searchAliases；
3. item.title；
4. applicability；
5. hint。

必须固定通过：

- 护照 → 出国旅行；
- 医保卡 → 住院准备、重要就医；
- 保险箱 → 离开酒店。

不要为了搜索引入大模型、向量数据库或远程服务。

## 十三、首页排序

实现为纯函数，并加入Golden Fixtures。

### 继续检查

1. 与已经到期 / 最近即将到期Planned Check关联的inProgress Run优先；
2. 其次`lastInteractedAt`最近；
3. 再按`startedAt`；
4. 首页只突出一个，但其他Run必须可访问。

### 接下来

最多3个`pending PlannedCheck`：

- 日期早优先；
- 有时间则按时间；
- 同日无时间在有时间之后；
- 最后按createdAt稳定排序。

## 十四、检查交互

必须：

- 点击模板直接开始；
- 主点击仅`unchecked ↔ confirmed`；
- `notNeeded`独立次级动作；
- 状态即时可逆；
- 关键项视图；
- 临时项；
- oneTimeNote；
- 本次排序；
- 分组；
- 完成组可轻量折叠；
- 中断恢复；
- 正常完成；
- unresolved结束；
- 关键项未确认二次确认；
- 丢弃；
- 重开；
- 基于历史重新开始。

关键项视图只能改变显示，不能改变：

> 完成计算、未确认数量、关键项风险事实。

## 十五、计划与提醒

### 必须

- 日期必选；
- 时间可选；
- Planned Snapshot；
- 提前开始；
- consumed / canceled后不继续显示为未来计划；
- L0应用内计划提示。

### 优先增强

- 当前平台可靠支持时：加入系统日历 / 导出日历事件。

### 条件实现

Web Push、微信订阅消息等必须先核验实施当天官方能力。

如果可靠实现需要：

- 后端；
- 新产品账号；
- 新云同步体系；
- 用户明显复杂配置；

则不属于V1硬门，诚实降级。

## 十六、分享与隐私

### 官方模板

平台允许时可深链稳定templateId。

### 个人模板

优先：

- 可读文本；
- 分享卡；
- 复制。

无服务器时不要伪装长期在线互动链接。

### 本次结果

单独动作。

默认不带：

- oneTimeNote；
- 用户未明确选择的历史信息；
- 额外敏感内容。

分享前预览将要分享的内容。

所有用户文本按纯文本安全渲染，避免把导入内容当HTML执行。

## 十七、本地个性化

这是P2增强，不得阻塞V1发布。

只有A类硬门全部稳定后再实现：

- 临时项重复≥集中配置阈值 → 建议沉淀；
- notNeeded重复≥阈值 → 建议检查个人模板。

禁止自动修改用户资产。

## 十八、PWA页面与体验

至少：

- 首页；
- 检查运行页；
- 全部进行中 / 全部计划；
- 模板详情 / 管理；
- 新建 / 编辑个人模板；
- 搜索；
- 历史列表 / 详情；
- 数据与备份；
- 设置。

重点尺寸：

- 375px；
- 390px；
- iPhone安全区；
- 触控区域≥44px；
- 不依赖Hover；
- 无横向溢出。

Mac：

> 模板编辑、历史、数据管理必须体现大屏增强，不只是手机页面拉宽。

## 十九、PWA离线与安装真实验收

真实链路：

1. 联网首次打开；
2. 缓存完成；
3. 创建个人模板；
4. 启动Run并勾选若干项；
5. 关闭网络；
6. 完全关闭页面 / Web App；
7. 重新打开；
8. 继续；
9. 完成；
10. 查看历史；
11. 恢复网络。

失败则Offline-first Core不通过。

安装形态：

- 手机普通浏览器；
- 手机添加到主屏；
- Mac Safari；
- macOS Sonoma 14+ Safari Add to Dock独立Web App。

实施时仍须核验当前Apple官方说明和真实设备。

## 二十、微信原生体验

不要做“网页转小程序”。

微信端可以：

- 更轻的首页；
- 微信原生导航；
- 微信原生分享；
- 平台原生状态反馈。

但业务事实必须与PWA一致。

任何订阅消息、文件能力、系统能力：

> 以实施当天微信官方文档和当前账号实测为准。

## 二十一、安全与输入边界

至少：

- JSON导入Schema校验；
- 合理文件大小限制；
- 未知未来格式明确拒绝；
- 用户文本按纯文本渲染；
- 不执行导入内容；
- 不在前端保存服务端密钥；
- 不引入Analytics / 广告SDK；
- 本地诊断日志如存在必须有容量上限；
- 诊断日志默认不记录模板正文、用户备注或敏感医疗内容。

## 二十二、自动化与跨端合规测试

至少：

- unit tests；
- domain / state-machine tests；
- contract conformance tests；
- template integrity tests；
- search tests；
- home ranking tests；
- backup / restore tests；
- migration tests；
- persistence failure tests；
- PWA critical-path E2E；
- responsive smoke tests。

两端均必须对`contracts/domain-contract-cases.v1.1.json`给出一致业务结果。

平台无法自动化的部分：

> 真机固定回归＋证据记录。

## 二十三、关键不变量最低清单

至少测试：

1. Run不污染Template；
2. notNeeded不跨Run；
3. Run启动后模板修改不改变本次；
4. Planned Check创建后模板修改不改变计划快照；
5. 官方升级不改变既有计划；
6. unchecked存在时不能completed；
7. key unchecked结束经过二次确认；
8. key-only视图不制造假完成；
9. 重开保留此前关闭事件；
10. 重开窗口后旧Run不可直接改写；
11. 同模板多Run不自动合并；
12. 写入失败不静默成功；
13. 个人模板软删除可恢复；
14. 官方模板不受个人删除影响；
15. 官方升级不覆盖个人模板；
16. 恢复失败不破坏当前数据；
17. migration失败不破坏旧数据；
18. 未知未来backupFormatVersion拒绝；
19. 日期级计划不因时区变化漂移；
20. consumed / canceled计划不继续提醒；
21. 分享清单默认不包含oneTimeNote；
22. 搜索三个固定case通过；
23. 首页排序在相同输入下确定；
24. 模板ID / itemId永不重复；
25. PWA离线冷启动通过；
26. schema变化版本不发生不兼容并发写损坏。

## 二十四、视觉状态验收

不要只截首页。

手机PWA至少检查：

1. 新用户首页；
2. 一个进行中Run；
3. 多个进行中Run；
4. 普通Run；
5. 关键项视图；
6. notNeeded动作；
7. 关键项未确认结束确认；
8. 完成页；
9. unresolved结束页；
10. 模板编辑；
11. 数据与备份。

Mac至少：

- 首页；
- 模板管理；
- 历史详情；
- 数据管理。

微信至少：

- 首页；
- Run；
- 结束；
- 分享。

## 二十五、部署

PWA必须争取真实HTTPS公网URL。

选择部署方案时按：

1. 当前环境能真实部署；
2. 用户操作最少；
3. HTTPS；
4. 静态PWA稳定；
5. 中国大陆日常访问便利性；
6. 后续维护简单。

如果外部账号阻塞：

- 本地构建和全部可验证工作继续完成；
- 把Codex可做的先做到头；
- 只请求用户完成唯一真实授权动作；
- 授权后继续部署和验收。

## 二十六、微信真实推进链

尽量推进：

> 编译 → 开发者工具运行 → 真机预览 → 体验版 → 审核前检查 → 可提交时提交 → 可发布时继续发布

不能把“开发者工具能跑”写成“微信端完成”。

## 二十七、需求证据矩阵

只给真正P0 / P1硬门分配Requirement ID，避免重型项目管理。

最终至少形成：

| Requirement | PWA | 微信 | 自动测试 / 合同 | 真实终端证据 | 状态 |
|---|---|---|---|---|

必须覆盖：

- 状态真实性；
- Planned Snapshot；
- Run Snapshot；
- 写入失败；
- Offline Core；
- Backup / Restore；
- Migration；
- 官方模板身份；
- 搜索；
- 分享隐私；
- 双端合规。

## 二十八、最终交付证据包

最终报告必须给：

1. PWA真实URL；
2. 代码仓库 / 目录状态；
3. 已实现功能；
4. 自动测试命令与结果摘要；
5. domain contract结果；
6. 关键E2E结果；
7. 离线冷启动结果；
8. persistent storage能力与实测结果；
9. backup / restore成功＋失败路径；
10. migration成功＋失败路径；
11. PWA三种实际使用形态；
12. 微信推进到哪个真实阶段；
13. 平台能力矩阵及降级项；
14. 外部真实阻塞；
15. 已知缺陷和复现方法；
16. 用户只需完成哪些最小动作；
17. V1稳定验证期开始方式。

任何“已验证”必须有可检查证据。

## 二十九、发布后的停止门

V1上线后不要立即开发普通新功能。

先：

> **约2周＋至少30次真实Check Run＋人工价值复核**

普通功能进入候选池。

重点观察：

- 还会不会漏重要事项；
- 使用后还会不会反复回想；
- 哪些项目语义让人困惑；
- 哪些平台差异破坏信任；
- 用户是否开始过度配置工具。

## 三十、Codex自主权

以下无需询问用户：

- 包管理器；
- 文件结构；
- 测试库；
- IndexedDB封装；
- UI组件实现；
- CSS方案；
- 命名细节；
- 低风险重构；
- 测试修复；
- 本地Mock；
- 当前平台能力的技术适配。

必须停下并明确记录，而不是偷偷改产品的情况：

- 正式主源互相冲突；
- 当前平台事实证明某个A类硬门物理不可实现；
- 需要新增后端 / 账号 / 云同步才能实现被冻结为V1核心的能力；
- 数据迁移存在不可恢复破坏风险；
- 需要用户本人完成外部权限动作。

除此之外：

> **继续推进，直到当前环境能达到的最高真实状态。**

【任务书结束｜Codex_别忘了_双端开发_任务书_V1.1】
