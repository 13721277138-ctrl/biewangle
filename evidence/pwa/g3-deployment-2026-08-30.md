# G3 PWA 生产审计与部署证据（2026-08-30）

## 状态

- 本地完整 PWA 基线提交：`b35f0f4`。
- 生产边界扫描、Lighthouse、GitHub Pages 子路径构建与完整 Chrome E2E：已通过。
- GitHub 仓库：`https://github.com/13721277138-ctrl/biewangle`，公开仓库，默认分支 `main`。
- GitHub Pages：`https://13721277138-ctrl.github.io/biewangle/`，GitHub Actions 构建，强制 HTTPS。
- 公网完整 Chrome E2E、离线冷启动、manifest / Service Worker / 安装性与 Lighthouse：已通过。

最后复验时间：2026-08-30 11:56 CST（Asia/Shanghai）。

## Lighthouse 13.4.1

目标：本机生产预览 `http://127.0.0.1:4173/`，Chrome Headless，模拟移动端与桌面端；分类为 Performance、Accessibility、Best Practices。

| 形态 | Performance | Accessibility | Best Practices | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| Mobile | 96 | 100 | 100 | 2.1 s | 2.5 s | 10 ms | 0 |
| Desktop | 100 | 100 | 100 | 0.4 s | 0.6 s | 0 ms | 0 |

公网 HTTPS 地址复验：

| 形态 | Performance | Accessibility | Best Practices | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| Public Mobile | 98 | 100 | 100 | 1.8 s | 1.9 s | 0 ms | 0 |
| Public Desktop | 99 | 100 | 100 | 0.6 s | 0.7 s | 0 ms | 0 |

原始、可复核报告：

- `evidence/pwa/lighthouse/local-mobile.report.json`
- `evidence/pwa/lighthouse/local-mobile.report.html`
- `evidence/pwa/lighthouse/local-desktop.report.json`
- `evidence/pwa/lighthouse/local-desktop.report.html`
- `evidence/pwa/lighthouse/public-mobile.report.json`
- `evidence/pwa/lighthouse/public-mobile.report.html`
- `evidence/pwa/lighthouse/public-desktop.report.json`
- `evidence/pwa/lighthouse/public-desktop.report.html`

Lighthouse 13 不再提供旧版单独 PWA 分类；安装图标、manifest、Service Worker、离线冷启动、导航回退由生产构建检查、浏览器 E2E 和真实浏览器验收分别覆盖，不能拿 Performance 分数代替安装/离线事实。

## 运行时信任边界

新增 `scripts/verify-runtime-boundaries.mjs`，并用 `tests/security/runtime-boundaries.test.ts` 先证明：

1. 自包含运行时与标准 SVG namespace 会通过；
2. 远程 CDN、`dangerouslySetInnerHTML` 与内嵌密钥样例会失败；
3. 对真实 authored runtime 与生产产物执行扫描。

真实扫描结果：

```text
runtime-boundary: PASS (41 authored files, 40 production files)
```

扫描门禁覆盖：运行时远程 URL、Analytics / 广告 SDK、非必要远程错误追踪、危险 HTML / 动态代码入口、常见密钥形态。构建依赖不属于运行时扫描目标。

## GitHub Pages 子路径实测

构建环境：

```text
VITE_BASE_PATH=/biewangle/
vite 8.2.2
35 precache entries, 571.25 KiB
```

生产 HTML 的 manifest、图标、JS 与 CSS 均指向 `/biewangle/`；manifest 本身使用相对 `id`、`start_url`、`scope`、图标与快捷入口。React Router 同时使用 `/biewangle` basename。

在 `http://127.0.0.1:4173/biewangle/` 对该生产产物运行完整 Playwright Chrome 门禁：

```text
8 passed (19.5s)
```

覆盖 WCAG A/AA、键盘与 reduced-motion、个人模板/隐私备注/历史/备份恢复、离线冷启动、375/390/1440 响应式和可信纵切。第一次复验暴露“旧预览进程仍按根路径提供静态资源”的测试环境错误；以同一个 `VITE_BASE_PATH` 重新启动生产预览后，资源 MIME 正确且 8/8 全绿。这也证明构建与预览必须共享部署 base path。

## GitHub / 真实部署

只读检查结果：

```text
gh 2.97.0
You are not logged into any GitHub hosts.
GITHUB_TOKEN=absent
GH_TOKEN=absent
VERCEL_TOKEN=absent
NETLIFY_AUTH_TOKEN=absent
CLOUDFLARE_API_TOKEN=absent
```

因此当时没有可冒用的托管凭据。用户只完成了一次 GitHub 官方设备授权；凭据由 GitHub CLI 写入 macOS keyring，没有进入仓库、源码、环境文件或证据包。随后 Codex 完成了：

1. 创建公开仓库 `13721277138-ctrl/biewangle`；
2. 推送 `main` 与 `codex/v1.1-implementation`；
3. 把 Pages 构建来源设为 GitHub Actions 并强制 HTTPS；
4. 观察云端门禁、修正分支发布策略并完成公网验收。

第一次工作流 `33290226201` 的 build 全绿，但 GitHub 默认 `github-pages` 环境只允许 `main`，因此 deploy 被生产保护规则拒绝。没有放宽环境保护；工作流改为只从 `main` 发布，并将已验证 G3 检查点快进至 `main`。

成功工作流：`https://github.com/13721277138-ctrl/biewangle/actions/runs/33291162436`

```text
headSha: 7c4c57c384db42945033e4690e5df037d8cffb0a
build: success (1m12s)
deploy: success (10s)
conclusion: success
```

## 公网端点与浏览器验收

| 端点 | HTTP | MIME / 行为 |
|---|---:|---|
| `/biewangle/` | 200 | `text/html; charset=utf-8` |
| `/biewangle/manifest.webmanifest` | 200 | `application/manifest+json; charset=utf-8` |
| `/biewangle/sw.js` | 200 | `application/javascript; charset=utf-8` |
| `/biewangle/icons/icon-192.png` | 200 | `image/png` |
| 首次直开 `/biewangle/templates/new` | 404 文档后客户端恢复 | GitHub Pages 无服务端 rewrite；仓库 `404.html` 安全回到入口并恢复原深层路径，公网 E2E 已证明最终页面正确 |

远端执行全部 8 条 Chrome E2E：

```text
PLAYWRIGHT_BASE_URL=https://13721277138-ctrl.github.io/biewangle/
8 passed (1.3m)
```

其中 `full-v1` 从深层地址 `/templates/new` 首开，证明 404 回退恢复；`offline` 证明公网安装 Service Worker 后断网冷启动仍能读取 IndexedDB 中的未完成 Run。

Chrome DevTools Protocol 在独立持久浏览器 profile 上的安装性结果：

```text
manifestErrors: []
installabilityErrors: []
serviceWorker.scope: https://13721277138-ctrl.github.io/biewangle/
serviceWorker.active: activated
```

当前 Mac 是 macOS 13.3.1，Safari 的 Add to Dock 需要 macOS Sonoma 14 或更高，因此本机无法把 Safari 菜单点击伪装成已验收；Chrome 安装性、manifest 与 Service Worker 已真实验证，iPhone 主屏添加仍属于真实 iPhone 可用时的终端验收边界。
