# G0 平台能力矩阵（2026-08-29）

状态词只使用：`supported`、`degraded`、`blocked`、`requires-backend`、`requires-user-action`。

## 当前本机事实

| 项目 | 结果 | 状态 |
|---|---|---|
| macOS | 13.3.1 (22E772610a), Apple Silicon | `supported`（本地开发） |
| Safari | 已安装；当前 macOS 低于 Sonoma 14 | `blocked`（Add to Dock 实测） |
| Chrome / Edge | 已安装 | `supported`（普通浏览器与自动化） |
| 微信 | 普通客户端已安装 | `supported`（用户微信） |
| 微信开发者工具 | 未安装 | `requires-user-action`（下载后仍需扫码/AppID） |
| Node | Codex bundled Node 可用；系统 PATH 未直接暴露 `node` | `supported` |
| pnpm | Codex bundled pnpm 11.19.0 | `supported` |
| Git | 2.39.2；当前目录已是空仓库，main 尚无提交 | `supported` |
| GitHub CLI | gh 2.97.0，尚未登录 | `requires-user-action`（到远端阶段登录） |
| Codex desktop project | “忘了吗”已登记为本地 Git 项目 | `supported` |
| Codex Cloud CLI | `codex cloud` 命令存在；云仓库仍需 GitHub/GitLab 远端 | `degraded` |

## PWA

| 能力 | 结论 | 状态 | 实现/降级 |
|---|---|---|---|
| Web App Manifest | 现代浏览器与 iOS 主屏 Web App 支持 | `supported` | 提供 id、name、icons、standalone、theme/background color |
| iPhone 添加到主屏 | Apple 当前用户指南支持 | `supported` | 真实 iPhone 操作仍需用户终端 |
| Mac Safari Add to Dock | Apple 要求 macOS Sonoma 14+；当前是 13.3.1 | `blocked` | 完成 Safari 网页形态，本机升级/另一台 Sonoma+ 后补独立 Web App 实测 |
| IndexedDB | 浏览器核心本地数据库能力 | `supported` | Dexie + 事务 + failure injection |
| StorageManager persisted/persist | 浏览器差异存在 | `degraded` | 运行时 feature detect；拒绝/不支持不阻断使用，数据页诚实显示 |
| Service Worker 离线冷启动 | PWA 核心可实现 | `supported` | Workbox precache + navigation fallback + 离线 E2E |
| SW 更新与活跃 Run | 可由应用控制 | `supported` | 不在活跃 Run 中无条件 skipWaiting/reload |
| 文件导入/导出 | file input、Blob download 可实现 | `supported` | JSON 备份恢复 + Markdown/TXT 下载 |
| Web Share | 平台差异存在 | `degraded` | feature detect；失败回退到剪贴板/下载 |
| 系统日历 | 浏览器无统一可靠直接写入 | `degraded` | 生成 `.ics` 作为 L1 导出 |
| Web Push | iOS/iPadOS 16.4+ 主屏 Web App 支持，但发送需要服务端/推送订阅基础设施 | `requires-backend` | V1 保持 L0 应用内计划提示，不引入后端 |

## 微信小程序

| 能力 | 官方能力事实 | 状态 | 实现/降级 |
|---|---|---|---|
| 本地持久化 | `wx.setStorage`；单 key 1 MB、总计 10 MB，可能因用户/空间原因清理 | `supported` | 异步双槽快照、读回校验、错误可见、完整备份 |
| JSON 导入 | `wx.chooseMessageFile` 从客户端会话选择文件 | `degraded` | 支持从微信会话导入；不宣称任意系统文件选择 |
| JSON 文件分享 | `wx.shareFileMessage` 可转发本地/临时文件到聊天 | `supported` | 生成 Backup Envelope 文件后显式分享 |
| PC 保存到磁盘 | `wx.saveFileToDisk` 仅 PC 端 | `degraded` | PC 可保存；手机使用文件分享/复制 |
| 可读文本 | `wx.setClipboardData` | `supported` | Markdown/TXT 复制，内容明确预览 |
| 官方模板分享 | `Page.onShareAppMessage` | `supported` | 稳定 templateId 路径，不带用户私密字段 |
| 系统日历 | `wx.addPhoneCalendar`，需要 `scope.addPhoneCalendar` | `supported` | 仅用户主动动作，失败诚实显示 |
| 订阅消息 | `wx.requestSubscribeMessage` 需要后台模板 ID；真正发送还需要账号/服务端调用链 | `requires-backend` | 不作为 V1 硬门，不显示虚假提醒成功 |
| 更新机制 | `wx.getUpdateManager` | `supported` | 提示更新；活跃 Run 先持久化，避免突然丢状态 |
| 开发者工具/真机/体验版 | 需要官方工具、扫码、AppID 与账号权限 | `requires-user-action` | 代码与自动测试先做到头，阻塞点只请求最小授权 |

## 官方来源

- OpenAI Codex Cloud 设置：[Codex cloud](https://learn.chatgpt.com/docs/cloud)
- OpenAI Cloud 环境：[Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment)
- Apple Mac Web App（Sonoma 14+）：[Use Safari web apps on Mac](https://support.apple.com/en-euro/104996)
- Apple iPhone 主屏 Web App：[Turn a website into an app in Safari on iPhone](https://support.apple.com/en-gb/guide/iphone/iphea86e5236/ios)
- WebKit iOS/iPadOS Web Push：[Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- 微信本地存储：[wx.setStorage](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorage.html)
- 微信会话文件选择：[wx.chooseMessageFile](https://developers.weixin.qq.com/miniprogram/dev/api/media/image/wx.chooseMessageFile.html)
- 微信文件分享：[wx.shareFileMessage](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.shareFileMessage.html)
- 微信 PC 文件保存：[wx.saveFileToDisk](https://developers.weixin.qq.com/miniprogram/dev/api/file/wx.saveFileToDisk.html)
- 微信剪贴板：[wx.setClipboardData](https://developers.weixin.qq.com/miniprogram/dev/api/device/clipboard/wx.setClipboardData.html)
- 微信页面分享：[Page.onShareAppMessage](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#onShareAppMessage-Object-object)
- 微信系统日历：[wx.addPhoneCalendar](https://developers.weixin.qq.com/miniprogram/dev/api/device/calendar/wx.addPhoneCalendar.html)
- 微信订阅授权：[wx.requestSubscribeMessage](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)
- 微信更新管理：[wx.getUpdateManager](https://developers.weixin.qq.com/miniprogram/dev/api/base/update/wx.getUpdateManager.html)

