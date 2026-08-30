# PWA 生产部署

## 部署目标

“别忘了”PWA 是纯静态、Local-first 应用。生产运行时不需要服务端、产品账号、云数据库、远程字体、Analytics、广告或密钥。用户数据只写入当前浏览器的 IndexedDB；部署更新不会自动同步或上传用户数据。

当前首选部署目标为 GitHub Pages：仓库分支触发 `.github/workflows/deploy-pages.yml`，完成内容校验、单元测试、类型检查、生产构建、Chrome E2E、运行时边界扫描后，才上传 `pwa/dist` 并发布 HTTPS 页面。

当前生产地址：`https://13721277138-ctrl.github.io/biewangle/`

当前仓库：`https://github.com/13721277138-ctrl/biewangle`

## 构建与本地复验

本机使用项目声明的 Node 24 与 pnpm 11.19.0：

```sh
pnpm install --frozen-lockfile
pnpm content:check
pnpm test
pnpm typecheck
pnpm build
pnpm e2e
pnpm verify:boundaries
```

GitHub Pages 项目站点部署在仓库子路径。可在本地用相同路径构建并复验：

```sh
VITE_BASE_PATH=/biewangle/ pnpm --filter @biewangle/pwa build
VITE_BASE_PATH=/biewangle/ pnpm --filter @biewangle/pwa preview
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173/biewangle/ pnpm --filter @biewangle/pwa e2e
```

`manifest.webmanifest` 使用相对 `id`、`start_url`、`scope`、图标和快捷入口；应用从 `BASE_URL` 生成静态资产地址与 React Router 的 `basename`。`404.html` 只负责在 GitHub Pages 首次打开深层地址时回到入口并恢复原路径，Service Worker 安装后继续提供离线导航回退。

## GitHub Pages 发布

自动工作流只监听受保护的发布分支 `main`，也允许在 Actions 页面手动触发。仓库需要把 Pages 构建来源设为 GitHub Actions；工作流仅使用 GitHub 自动下发的短期 `GITHUB_TOKEN` 和 OIDC 权限，不保存长期部署密钥。

GitHub 登录后，Codex 已完成创建远端、设置 Pages、推送分支、观察工作流、取得 HTTPS URL，并在真实 URL 上重跑完整 E2E。用户只完成了 GitHub 网页登录/授权这一项不可替代账号动作。

远端验收命令：

```sh
PLAYWRIGHT_BASE_URL=https://13721277138-ctrl.github.io/biewangle/ pnpm --filter @biewangle/pwa e2e
```

发布证据、工作流运行地址、端点 MIME、远端 E2E、安装性与最终 URL 记录在 `evidence/pwa/g3-deployment-2026-08-30.md`。
