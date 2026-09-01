# 微信小程序构建、预览与发布

## 当前交付状态

- 原生项目：`miniprogram/`
- 产品版本：`1.1.0`
- 当前 AppID：`wx325ab0bf02863343`（独立小程序测试号）
- 官方模板：13 个，由冻结 Markdown 内容库确定性生成
- 原生页面：11 个，不含 `web-view`
- 官方开发者工具：已逐页编译通过
- 手机预览：已推送到当前开发者微信
- 体验版：`1.1.0` 已上传成功
- 2026-08-31 语义审计后复验：官方编译、手机自动预览和同版本体验构建重新上传成功
- 2026-09-01 视觉整改复验：iPhone 12/13 (Pro)、HUAWEI Mate 70 Pro / HarmonyOS、Nexus 5X / Android 默认字体官方模拟器证据均通过；未发现仍需阻断的 P0、P1、P2
- 2026-09-01 视觉与语义复验后上传：测试号 `1.1.0` 成功，包体 `189855 bytes`
- 2026-09-01 Android 次级 7 页复验：修复模板编辑器内部 token 直出这一项 P2；复验后预览 `190070 bytes`、测试号 `1.1.0` 体验构建 `190569 bytes` 均成功
- 平台审核 / 正式发布：尚未声称完成；需要正式小程序主体和公众平台权限

测试 AppID 不是密钥，可以进入项目配置；不要把 AppSecret、访问令牌、扫码登录票据或预览二维码提交到仓库。`project.private.config.json` 与 `evidence/wechat/*preview-qr*` 已被 Git 忽略。

## 本地准备

项目声明 Node.js 24.x 与 pnpm 11.19.0：

```sh
pnpm install --frozen-lockfile
pnpm content:check
pnpm verify:boundaries
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm miniprogram:verify
```

静态门会核验：

- 11 个页面及每页 JS/JSON/WXML/WXSS 文件；
- 13 个官方模板与唯一 `official.*` 身份；
- WXML 事件均在对应页面定义；
- 原生分享入口具有 `onShareAppMessage`；
- 主包不超过 2 MB；
- 无 `web-view`、网络、云开发、产品账号、追踪 SDK 或可疑凭据；
- `project.config.json` 的真实 AppID 状态。

## 微信开发者工具

在 macOS 导入：

```text
/Users/thy/Documents/ChatGPT/忘了吗/miniprogram
```

导入时选择“小程序”，AppID 使用目标小程序自己的 AppID。生产发布前必须把 `project.config.json` 从当前测试号改为正式小程序 AppID，并再次执行全部门禁、官方编译和真机回归。

当前机器使用官方稳定版微信开发者工具 `2.02.2608060`。应用具有腾讯 Developer ID 签名并通过 Apple notarization。命令行入口：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/wechatide
```

## 预览与体验版

开发者工具登录后，可在 GUI 中点击“预览”或“上传”。当前自动化使用的等价命令为：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/wechatide \
  -c codex-biewangle create_preview_qrcode \
  --project "/Users/thy/Documents/ChatGPT/忘了吗/miniprogram" \
  --page-path pages/home/home \
  --scene 1001

/Applications/wechatwebdevtools.app/Contents/MacOS/wechatide \
  -c codex-biewangle auto_preview \
  --project "/Users/thy/Documents/ChatGPT/忘了吗/miniprogram" \
  --page-path pages/home/home \
  --scene 1001

/Applications/wechatwebdevtools.app/Contents/MacOS/wechatide \
  -c codex-biewangle upload \
  --project "/Users/thy/Documents/ChatGPT/忘了吗/miniprogram" \
  --upload-version 1.1.0 \
  --desc "别忘了 V1.1 微信视觉整改与数据语义一致性复验"
```

本轮最新实测：次级页面修复后的预览二维码和手机自动预览包体均为 `190070 bytes`；体验构建上传包体为 `190569 bytes`。

二维码只用于短期预览，不要发到公开 issue、提交到 GitHub 或长期当作发布入口。

## 真机最低回归

体验版在 iPhone / Android 微信中至少检查：

1. 首页显示精选 7 个场景，并能进入全部 13 个官方模板；
2. 直接开始同一模板两次，生成两个不同 Run；
3. 确认、撤销确认、本次不需要、临时项、关键项、备注和排序在杀进程后恢复；
4. 未确认关键项结束必须经过两层确认，并在历史中显示“有未确认项结束”；
5. 全部处理后才显示“已完成”；
6. 从历史重新开始不继承旧 Run 的临时项、备注或勾选状态；
7. 复制完整备份、复制可读文本、真实手势分享 JSON 文件；
8. 从微信聊天选择不超过 10 MB 的 JSON，先预览，再确认整体恢复；
9. 强确认清空后可用先前备份恢复；
10. 飞行模式下浏览模板、继续 Run、计划和历史仍可用。

文件分享与聊天文件选择需要微信真实用户手势，模拟器脚本不能替代最后一次真机点击。系统日历也需要真机权限；拒绝权限不得影响已经本地提交的计划。

## 视觉整改基线

整改前问题记录见 `evidence/wechat/ui-audit-2026-08-31/audit.md`；整改后的阻断式对照审计与工具原始事实见 `evidence/wechat/ui-restoration-2026-08-31/design-qa.md` 和 `tool-results.md`。当前官方模拟器默认字体结论：

- iPhone 12/13 (Pro) 390 × 844：核心流程与 9 个要求状态通过；
- HUAWEI Mate 70 Pro / HarmonyOS 376 × 809：首页与普通 Run 通过；
- Nexus 5X / Android 411 × 731：首页与普通 Run 通过；
- Run 状态、视图与 Dock 按钮在三平台实测高度为 44–48px；关键徽标、标题和状态文字最大 top 差值低于 1px；
- “只看关键”在 Android 再次回读为可见 2 项、总未确认 12、关键未确认 2，视觉整改没有改写 Run 事实。
- Nexus 5X / Android 还逐页复验了计划、历史、历史详情、数据、搜索、模板编辑和全部进行中；模板编辑器改为中文显示标签，但运行时仍保存 `icon` / `themeColor` 原 token，修复前后领域事实未改变。证据见 `evidence/wechat/secondary-pages-android-2026-09-01/audit.md`。

视觉整改没有改写官方模板文案、Local-first 边界、Run/Plan 冻结语义、持久化成功顺序或分享隐私规则。这里的“视觉验收通过”只覆盖官方模拟器默认字体档；较大微信字体、物理手机完整流程、屏幕阅读器和需要系统用户手势的能力仍须真机验证。

## 正式发布边界

当前测试号只用于开发预览和体验验证。正式发布需要：

1. 用户拥有或注册正式微信小程序主体；
2. 在公众平台把开发者加入该小程序，并完成所需类目、隐私与合规配置；
3. 将项目切换到正式 AppID；
4. 重新执行全量本地门、官方编译、预览和真机最低回归；
5. 上传新的生产候选版本；
6. 在微信公众平台提交审核，并由有权限的账号在审核通过后发布。

这些账号动作不能由测试号或本地代码替代。在完成前，文档和 UI 都不得称为“微信正式上线”。

完整实测记录见 `evidence/wechat/g5-full-v1-2026-08-30.md`；2026-08-31 的数据语义审计见 `evidence/wechat/g5-semantic-audit-2026-08-31.md`；整改前视觉问题见 `evidence/wechat/ui-audit-2026-08-31/audit.md`；整改后的跨平台视觉与语义回读见 `evidence/wechat/ui-restoration-2026-08-31/`；Android 次级 7 页、模板标签修复和当前最新体验构建见 `evidence/wechat/secondary-pages-android-2026-09-01/audit.md`。

跨平台 P0 / P1 与 26 项最低不变量的统一索引见 `evidence/requirements-matrix.md`；最终真实交付阶段和外部阻塞见 `evidence/final-delivery-report.md`。
