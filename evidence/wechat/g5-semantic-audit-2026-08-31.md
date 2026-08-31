# G5 微信端数据语义审计与重新部署（2026-08-31）

## 结论

在 G5 完整 V1 的官方编译、模拟器和体验版证据基础上，本次对 shared domain、微信 native domain、双槽存储、服务提交顺序与原生页面投影做了一次专项数据语义审计。审计发现的缺口均先用可重现失败测试锁定，再修复 shared/native 双端，并用官方微信开发者工具重新编译、预览和上传。

当前最高真实状态仍是独立小程序测试号的体验构建；没有正式主体 / 生产 AppID / 公众平台审核权限前，不声称微信正式上线。

## 已修复的语义缺口

1. **双槽恢复指针未修复**：旧实现能从另一有效槽读回事实，但不修复 `active` 指针；下一次 commit 可能把刚恢复的可信槽当作 inactive 覆盖。现在缺失、非法或指向损坏槽时，都会先验证恢复槽、持久化修复指针，指针修复失败则明确停止。
2. **Planned Check 与 Run 可串线**：旧校验只核对双向 ID，一个“离开酒店”计划可以被伪造关联到“日常出门” Run。现在还必须深度一致核对 `sourceTemplateIdentity` 与 `plannedTemplateSnapshot/runTemplateSnapshot`。
3. **关闭 / 重开事件链允许不可能事实**：现在精确要求进行中 Run 的关闭事件数等于 `reopenCount`，已关闭 Run 等于 `reopenCount + 1`；`lastReopenedAt` 与重开次数必须同时有/无；`discarded` 不能出现在可重开的历史节点；每个关闭事件的未处理数、关键项数和关闭类型必须内部自洽。
4. **备份格式在双端拒绝边界不同**：微信手写 ISO 校验原会接受非闰年 `2026-02-29` 和 `24:00:00`，整数校验也会接受超过 JavaScript 安全范围的数值。现在日历、时间、时区偏移和 safe-integer 边界与 shared Zod 合同一致。
5. **默认临时项 ID 派生不一致**：未显式传 `runItemId` 时，shared 域曾用未去空格标题派生 ID，微信域用规范化标题。现在双端均先 `trim`，同一输入得到同一事实身份。
6. **微信关闭回执被立即跳转吞掉**：现在完成、有未确认项结束和放弃均在当前 Run 页从已落盘 `closedEvent` 投影回执，不再依赖页面临时计数。正式冻结文案为“这份清单已全部处理 / 可以放心出发。”与“本次检查已结束 / 仍有 X 项未确认，其中 Y 项为关键项。”。
7. **返回源页后永久 busy**：从首页、模板库、模板详情或搜索页开始 Run 后返回，旧页面会一直拒绝下一次操作。现在在 `onShow/refresh` 重新建立页面事实时释放该锁。
8. **数据与视图信息不完整**：Run 项现在显示冻结分组标题；数据页现在显示已持久化的 `lastBackupAt`，并保留“生成不等于已异地保存”边界说明。

## 新增回归证据

- shared 备份业务不变量：计划/Run 冻结事实、事件链计数、终止丢弃、历史关闭计数以及真实“关闭 → 重开 → 放弃”正例。
- shared/native 差分合同：冻结事实串线、关闭链、ISO 日历、安全整数、默认临时项 ID 以及冻结结束回执。
- 微信页面级回归：持久化完成后不自动跳走，从服务层回读回执；返回导航源页后 busy 释放；Run 项具有分组投影。
- 双槽回归：丢指针、非法指针、活动槽损坏均修复到选中槽，不会在下次 commit 覆盖刚恢复的事实。

## 2026-08-31 新鲜门禁

```text
pnpm content:check       PASS（Markdown 主源 = shared JSON = 微信派生 JS）
pnpm verify:boundaries   PASS（41 authored files, 40 production files）
pnpm lint                PASS
pnpm typecheck           PASS
pnpm test                PASS（27 files, 148 tests）
pnpm build               PASS（PWA precache 35 entries, 573.51 KiB）
pnpm miniprogram:verify  PASS（11 pages, 13 templates, 233137 bytes）
pnpm e2e                 PASS（8 / 8，含 accessibility / offline cold start / responsive）
git diff --check         PASS
```

## 官方微信工具重新验证与部署

使用官方稳定版微信开发者工具 `2.02.2608060`，登录态有效，对修复后源码实际执行：

```text
create_preview_qrcode  success  package=176753 bytes
auto_preview           success  package=176753 bytes
upload 1.1.0           success  package=177252 bytes
upload description     别忘了 V1.1 数据语义审计修复与完整链路复验
```

平台允许以原产品版本 `1.1.0` 更新开发/体验构建，因此未为此审计擅自改动产品版本号。

## 当前工具限制

2026-08-31 的官方编译、打包、手机自动预览和上传均成功。但开发者工具的 `automation_runtime_info`、`automation_evaluate` 与 `simulator_screenshot` 子通道在当前会话持续不返回，关闭并重开项目窗口后仍可复现；本机 Computer Use 服务也无法启动。因此本次不伪造新模拟器截图，视觉与真实业务闭环仍引用 2026-08-30 已成功的官方 Automator 证据；本次新增代码由页面级 Vitest、官方编译/预览/上传和全量门禁覆盖。

## 发布边界

- 已达到：本地原生工程、静态发布门、官方编译、预览二维码打包、手机自动预览、测试号体验构建上传。
- 未声称：生产 AppID、正式小程序主体、平台审核、正式发布。
- 下一个不可代替的账号操作：如要正式上线，由产品所有者提供/选定正式小程序 AppID 并授予开发者/审核权限，然后重跑全门禁和真机回归。
