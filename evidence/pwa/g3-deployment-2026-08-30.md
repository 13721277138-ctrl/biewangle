# G3 PWA 生产审计与部署证据（2026-08-30）

## 状态

- 本地完整 PWA 基线提交：`b35f0f4`。
- 生产边界扫描、Lighthouse、GitHub Pages 子路径构建与完整 Chrome E2E：已通过。
- GitHub Pages 工作流与深层地址回退：已在仓库准备。
- 真实公网 HTTPS URL：等待 GitHub 网页登录这一项不可替代账号授权；取得 URL 后必须继续跑远端验收，本文件才可改为已部署。

记录时间：2026-08-30 11:14 CST（Asia/Shanghai）。

## Lighthouse 13.4.1

目标：本机生产预览 `http://127.0.0.1:4173/`，Chrome Headless，模拟移动端与桌面端；分类为 Performance、Accessibility、Best Practices。

| 形态 | Performance | Accessibility | Best Practices | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| Mobile | 96 | 100 | 100 | 2.1 s | 2.5 s | 10 ms | 0 |
| Desktop | 100 | 100 | 100 | 0.4 s | 0.6 s | 0 ms | 0 |

原始、可复核报告：

- `evidence/pwa/lighthouse/local-mobile.report.json`
- `evidence/pwa/lighthouse/local-mobile.report.html`
- `evidence/pwa/lighthouse/local-desktop.report.json`
- `evidence/pwa/lighthouse/local-desktop.report.html`

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

## GitHub / 部署权限边界

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

因此当前没有可冒用的托管凭据。下一步只请求用户完成一次 `gh auth login` 网页授权；随后由 Codex 创建远端、配置 Pages 为 GitHub Actions、推送、观察部署并在真实 HTTPS URL 上复验。

## 公网发布后必须追加

- GitHub 仓库 URL；
- Pages 工作流 run URL 与结论；
- 实际 HTTPS URL；
- manifest、Service Worker、图标响应状态与 MIME；
- 远端关键 E2E、深层地址首开、离线冷启动结果；
- 真实浏览器安装入口/能力边界。
