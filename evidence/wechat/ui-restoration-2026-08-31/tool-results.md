# 微信视觉整改工具实测记录（2026-08-31）

## 结论状态

- 本地仓库全门禁：通过。
- 官方微信开发者工具 WXML / WXSS：11 页、22 次编译全部通过。
- 官方 iOS 模拟器：核心流程与 9 个要求状态已重新编译、操作和截图。
- 官方 Huawei / HarmonyOS 模拟器：首页与普通 Run 复拍、触控尺寸和字体基线均通过。
- 官方 Nexus 5X / Android 模拟器：首页与普通 Run 复拍、触控尺寸、字体基线和关键筛选事实均通过。
- 官方手机预览：二维码打包与自动推送均成功，包体 `189356 bytes`。
- 体验版上传：视觉阻断审计通过后，测试号 `1.1.0` 上传成功，包体 `189855 bytes`。

本记录不包含登录 openid、头像地址、扫码票据或预览二维码。短期二维码保存在 Git 忽略路径，不进入仓库。

## 源码与运行时

- 分支：`codex/v1.1-implementation`
- 微信视觉实现检查点：`628da86 feat(wechat): unify native visual hierarchy`
- 类型门修复检查点：`76cbc41 test(wechat): narrow bound handler types`
- Node.js：`24.x`
- pnpm：`11.19.0`
- 微信项目：`miniprogram/`
- AppID 身份：独立小程序测试号 `wx325ab0bf02863343`
- 微信开发者工具：官方稳定版 `2.02.2608060`
- wechatide skill：`0.3.9`
- WeChatLib：`3.17.2`（2026-08-28）
- 登录态：有效，生活微信开发者账号；不记录个人标识符。

## 仓库全门禁

从冻结锁文件开始真实执行：

```text
pnpm runtime:check          PASS（Node.js 24 / pnpm 11.19.0）
pnpm install --frozen-lockfile
                            PASS（Already up to date）
pnpm content:check          PASS（Markdown 主源 = shared JSON = 微信派生 JS）
pnpm lint                   PASS
pnpm typecheck              PASS
pnpm test                   PASS（30 files, 157 tests）
pnpm build                  PASS（PWA precache 35 entries, 573.51 KiB）
pnpm verify:boundaries      PASS（41 authored files, 40 production files）
pnpm miniprogram:verify     PASS（11 pages, 13 templates, 246670 bytes）
pnpm e2e                    PASS（8 / 8）
git diff --check            PASS
```

第一次并行门禁暴露一处测试辅助函数的严格空值类型错误：正则捕获被 TypeScript 推断为 `string | undefined`。产品运行时代码、微信事实和 157 个测试均未失败。修复为显式过滤 `undefined` 后，`lint`、`typecheck`、聚焦测试及全量测试重新通过，并单独提交为 `76cbc41`。

## 官方逐页编译

对冻结顺序中的 11 个页面分别调用官方 `compile_wxml` 和 `compile_wxss`：

```text
pages/home/home                         WXML PASS  WXSS PASS
pages/run/run                           WXML PASS  WXSS PASS
pages/plans/plans                       WXML PASS  WXSS PASS
pages/history/history                   WXML PASS  WXSS PASS
pages/data/data                         WXML PASS  WXSS PASS
pages/templates/templates               WXML PASS  WXSS PASS
pages/template-detail/template-detail   WXML PASS  WXSS PASS
pages/template-edit/template-edit       WXML PASS  WXSS PASS
pages/search/search                     WXML PASS  WXSS PASS
pages/more-runs/more-runs               WXML PASS  WXSS PASS
pages/history-detail/history-detail     WXML PASS  WXSS PASS
```

汇总：`22 / 22 PASS`。

## iOS 模拟器环境

官方运行时返回：

```text
model             iPhone 12/13 (Pro)
platform          devtools
window            390 x 753
screen            390 x 844
pixelRatio         3
fontSizeSetting    16（默认档）
language           zh_CN
SDKVersion         3.17.2
orientation        portrait
```

官方截图接口输出原始 PNG，单张像素尺寸为 `734 x 1588`；设备逻辑视口仍以运行时返回的 `390 x 844` 为准。

## Huawei / HarmonyOS 模拟器环境

用户在开发者工具设备下拉框选择华为后，官方运行时明确返回：

```text
model             HUAWEI Mate 70 Pro
system            HarmonyOS
platform          devtools
window            376 x 742
screen            376 x 809
pixelRatio         3.5
fontSizeSetting    16（默认档）
language           zh_CN
SDKVersion         3.17.2
orientation        portrait
```

该配置用于华为/鸿蒙兼容证据，不冒充 Android。原始截图输出为 `738 x 1586` PNG。

## Android 模拟器环境

用户在开发者工具设备下拉框改选 Nexus 5X 后，官方运行时明确返回：

```text
model             Nexus 5X
system            Android 5.0
platform          devtools
window            411 x 663
screen            411 x 731
pixelRatio         2.625
fontSizeSetting    16（默认档）
language           zh_CN
SDKVersion         3.17.2
orientation        portrait
```

原始首页和 Run 截图均为 `888 x 1580` PNG。设备切换后的第一次首页截图只绘制出平台导航栏；同一时刻页面 data、WXML、元素尺寸、scrollTop=0 和控制台均正常，说明选择器就绪早于 Android 渲染面首帧。该帧已拒收；等待 2 秒后重新捕获的 `12-home-android.png` 与 `13-run-android.png` 已逐张打开检查并接受。

## 真实页面链与事实回读

### 页面导航

从首页真实点击进入模板库，再从第一条官方模板点击详情，随后从详情底部点击“开始检查”。当前页面依次由官方运行时确认为：

```text
pages/home/home
pages/templates/templates
pages/template-detail/template-detail?id=official.daily_out
pages/run/run?id=<new run id>
```

### 冻结 Run 投影

新 Run 的冻结事实为“日常出门”：

- 12 项、2 个关键项；
- `随身核心` 5 项；
- `当天需要` 7 项；
- 初始 `unresolvedCount=12`、`unresolvedKeyCount=2`。

切换“只看关键”后，页面只渲染 2 项，但页头事实仍为 `12 / 2`，证明筛选只改变可见投影，不改总计数。

Android Nexus 5X 下再次执行同一筛选，官方回读为 `viewMode=key`、可见 2 项、`unresolvedCount=12`、`unresolvedKeyCount=2`；恢复“全部”后 `viewMode=all`。本次只改变页面实例的展示状态，没有写入 Run 或模板事实。

### 三态持久化

通过真实按钮操作并逐次回读页面服务结果：

1. “手机”从 `unchecked` 变为 `confirmed`；
2. “钥匙 / 门禁”从 `unchecked` 变为 `notNeeded`；
3. 总未确认从 12 变为 10，关键未确认从 2 变为 0；
4. 点击“恢复待查”后，“钥匙 / 门禁”回到 `unchecked`，总未确认 11、关键未确认 1。

第一次尝试使用复杂 `:nth-child` 自动化选择器时，工具返回交互成功但事实没有变化；随后的页面回读证明没有误写。改用开发者工具实际支持的简单选择器后，每次状态变化均由服务回读确认。

### 有未确认项结束

真实点击“结束本次检查”后，原生第一层弹窗显示：

```text
还有 11 项未确认
系统不会把它伪装成完成
```

由于本机 Computer Use 服务无法点击原生弹窗，后续确认使用微信官方 `automation_wx_api` 对 `wx.showModal` 注入 `confirm=true`；结束完成后立即恢复原 API。最终落盘事实：

```text
status               endedWithUnresolved
closedEvent.type     endedWithUnresolved
unresolvedCount      11
unresolvedKeyCount   1
receipt.title        本次检查已结束
receipt.message      仍有11项未确认，其中1项为关键项。
```

### 全部处理后完成

从同一官方模板创建不同 ID 的第二个 Run，通过页面“确认”按钮逐项操作 12 次。每次服务回读的未确认计数严格为：

```text
11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0
```

只有到 0 后结束，才落盘：

```text
status               completed
closedEvent.type     completed
unresolvedCount      0
unresolvedKeyCount   0
receipt.title        这份清单已全部处理
receipt.message      可以放心出发。
```

## 触控与基线实测

使用官方元素测量接口读取普通 Run：

```text
单项状态按钮      163.5 x 45 px
视图切换按钮      176.0 x 45 px
底部 Dock 按钮    177.0 x 45 px
```

全部达到至少 44px 的触控高度。首个关键徽标、项目标题与状态文字的 top offset 分别为 `200.664`、`200.039`、`200.039`，最大差值小于 1px；未再观察到旧版明显的行内基线错位。

华为/鸿蒙下的同类实测：

```text
单项状态按钮      156.5 x 44 px
视图切换按钮      169.0 x 44 px
底部 Dock 按钮    170.0 x 44 px
关键徽标 top      198.086 px
项目标题 top      198.133 px
状态文字 top      198.086 px
```

按钮恰好达到 44px 底线；三类行内文字最大 top 差值约 `0.05px`。首页和 Run 均未见横向溢出、按钮文字偏心、异常换行或 Dock 遮挡。

Nexus 5X / Android 下的同类实测：

```text
单项状态按钮      173.0 x 48 px
视图切换按钮      185.5 x 48 px
底部 Dock 按钮    186.5 x 48 px
关键徽标 top      209.180 px
项目标题 top      209.055 px
状态文字 top      209.055 px
Run 页面宽度      411 px
首个分组宽度      377 px（left=17px）
```

三类按钮均超过 44px 触控底线，行内文字最大 top 差值约 `0.13px`。首页与 Run 截图未见横向溢出、按钮文字偏心、异常换行或 Dock 遮挡；更短的 Android 视口仍可同时看到 Header、视图切换、前三项和底部 Dock。

## 控制台与网络

```text
console error/warn/fail/exception  无匹配
console 其余输出                 WeChatLib 与 lazy loading 启动信息
network                           空
```

运行时未发起产品网络请求。

## 手机预览

```text
create_preview_qrcode   PASS  package=189356 bytes
auto_preview            PASS  package=189356 bytes
page                    pages/home/home
scene                   1001
```

自动预览已经推送到当前开发者微信。二维码是短期访问凭证，保存在 Git 忽略路径，不作为公开证据提交。

## 体验版上传

阻断式 iOS / HarmonyOS / Android 默认字体视觉审计全部通过后，使用官方工具上传：

```text
version       1.1.0
description   别忘了 V1.1 微信视觉整改与数据语义一致性复验
result        PASS
package       189855 bytes
```

上传对象仍是独立小程序测试号，只代表体验构建，不代表公众平台审核或正式发布。

## 当前未完成边界

1. 官方模拟器默认字体的 iOS、HarmonyOS、Android 视觉审计均已通过；这不替代物理手机完整回归或较大微信字体档。
2. Computer Use 服务启动失败，因此设备切换由用户在开发者工具 GUI 完成；其余截图、事实回读、测量和上传均由官方 wechatide 通道执行。
3. 本证据不声称真机文件分享、聊天文件选择、系统日历授权、平台审核或正式发布完成。
