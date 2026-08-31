# Codex Cloud 可复现环境

## 代码侧就绪条件

本仓库不需要产品密钥、数据库或运行时环境变量。Codex Cloud 容器只需检出仓库、使用 Node.js 24 和 pnpm 11.19.0，然后执行：

```sh
pnpm install --frozen-lockfile
```

常规验证命令记录在根目录 `AGENTS.md`；需要浏览器 E2E 时额外执行：

```sh
pnpm --filter @biewangle/pwa exec playwright install --with-deps chrome
pnpm e2e
```

建议 Cloud 环境配置：

- Repository：`13721277138-ctrl/biewangle`
- Runtime：Node.js `24`
- Setup script：`npm install --global pnpm@11.19.0 && pnpm install --frozen-lockfile`
- Maintenance script：`pnpm install --frozen-lockfile`
- Environment variables / secrets：无
- Agent internet access：默认关闭即可；依赖安装阶段按平台默认允许联网

仓库已包含：

- 根级 `AGENTS.md`；
- `pnpm-lock.yaml` 和精确 pnpm 版本；
- 所有分支 push / pull request 的 GitHub CI；
- 纯静态 PWA 构建；
- 不依赖微信账号即可运行的原生工程静态门；
- P0 / P1 与 26 项不变量证据索引。

## 当前真实边界

截至 2026-08-31，远端默认分支 `main` 已包含根级 `AGENTS.md`、`pnpm-lock.yaml`、全分支 CI 和本文件；G6 的干净 clone、本地全门、分支 CI、`main` CI 与 Pages 部署均已通过。

本机 `codex cloud list` 能访问 Cloud 命令面并返回 `No tasks found`，但这只能证明 CLI 可访问服务，不能证明本仓库已经被 Codex Cloud 授权或已创建环境。应用内浏览器访问环境页时处于未登录状态，且没有可用的 Chrome 扩展登录态。仓库选择和 GitHub 授权属于用户账号范围，不能通过本地 Git remote 或 GitHub CLI 登录态推定完成。

OpenAI 官方流程要求：

1. 登录 Codex；
2. 连接 GitHub，并明确选择 Codex 可访问的仓库；
3. 为该仓库创建 Environment；
4. 选择环境开始第一项 Cloud 任务。

官方说明：

- [Codex cloud](https://learn.chatgpt.com/docs/cloud)
- [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment)

## 唯一不可替代的最小动作

第一步只需用户在已打开的 Codex Web 页面登录并回复“已登录”。随后 Codex继续检查环境页；若 GitHub 授权尚缺，再请用户在官方授权页勾选 `13721277138-ctrl/biewangle`，并按上面的配置创建一个 Environment。完成后可继续首个 Cloud 复现任务。

不要把以下事实写成“Cloud 已连接”：

- 本地仓库有 `origin`；
- GitHub CLI 已登录；
- CI 已通过；
- `codex cloud list` 没有报错；
- 文档中写了 setup 命令。
