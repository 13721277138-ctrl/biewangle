# Codex Cloud 可复现环境

## 代码侧就绪条件

本仓库不需要产品密钥、数据库或运行时环境变量。Codex Cloud 容器只需检出仓库、使用 Node.js 24 和 pnpm 11.19.0，然后执行：

```sh
pnpm runtime:check
pnpm install --frozen-lockfile
```

常规验证命令记录在根目录 `AGENTS.md`；需要浏览器 E2E 时额外执行：

```sh
pnpm --filter @biewangle/pwa exec playwright install --with-deps chrome
pnpm e2e
```

建议 Cloud 环境配置：

- Repository：`13721277138-ctrl/biewangle`
- Runtime：Universal 镜像；若网页的显式 Node 选项暂时只到 `22`，把它当作引导运行时，并由下面的 setup 恢复仓库冻结的 Node.js `24`
- Setup script：

  ```sh
  . "$NVM_DIR/nvm.sh"
  nvm install 24
  nvm alias default 24
  printf '24\n' > .nvmrc
  nvm use 24
  npm install --global pnpm@11.19.0
  pnpm runtime:check
  pnpm install --frozen-lockfile
  pnpm --filter @biewangle/pwa exec playwright install --with-deps chrome
  ```

- Maintenance script：

  ```sh
  . "$NVM_DIR/nvm.sh"
  nvm use 24
  nvm alias default 24
  printf '24\n' > .nvmrc
  npm install --global pnpm@11.19.0
  pnpm runtime:check
  pnpm install --frozen-lockfile
  ```

- Codex Cloud 的自定义脚本在非交互 shell 中运行：`NVM_DIR` 存在，但 `nvm` 函数不会自动加载，因此 setup 与 maintenance 都必须先 source `"$NVM_DIR/nvm.sh"`。2026-08-31 的临时容器实测结果为 Node.js `v24.20.0`、pnpm `11.19.0`、setup 与 maintenance 均成功。
- Environment variables / secrets：无
- Agent internet access：默认关闭即可；依赖安装阶段按平台默认允许联网

仓库已包含：

- 根级 `AGENTS.md`；
- `.nvmrc`、`engines.node` 与 `runtime:check` 三重 Node.js 24 钉住点；
- `pnpm-lock.yaml` 和精确 pnpm 版本；
- 所有分支 push / pull request 的 GitHub CI；
- 纯静态 PWA 构建；
- 不依赖微信账号即可运行的原生工程静态门；
- P0 / P1 与 26 项不变量证据索引。

## 当前真实边界

截至 2026-08-31，远端默认分支 `main` 已包含根级 `AGENTS.md`、`pnpm-lock.yaml`、全分支 CI 和本文件；G6 的干净 clone、本地全门、分支 CI、`main` CI 与 Pages 部署均已通过。

Codex Web 已登录并完成 GitHub 仓库授权核对，真实创建环境：

- Environment：`biewangle-v1.1-node24`
- Environment ID：`6a956037720c8191b93874a0a9d38999`
- Repository：`13721277138-ctrl/biewangle`
- Container cache：启用
- Agent internet access：关闭
- Environment variables / secrets：无

首次只读复现任务 `task_e_6a95609835a48332905b04202b683d1d` 已在 `main` 的 `47a5e900087b8eb5946dc6b54f9c141c3f32349b` 上完成。Cloud 报告 Node.js `v24.20.0`、pnpm `11.19.0`，27/27 测试文件、148/148 测试、8/8 E2E、11 页/13 模板静态门全部退出状态为 `0`；最终 `git status --short` 为空，Cloud 状态 `READY`、diff 为 `no diff`。

完整证据见 [`../../evidence/codex-cloud-smoke-2026-08-31.md`](../../evidence/codex-cloud-smoke-2026-08-31.md)。

官方说明：

- [Codex cloud](https://learn.chatgpt.com/docs/cloud)
- [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment)

## 后续使用

新 Cloud 任务直接选择 `biewangle-v1.1-node24` 与目标分支。若只做复现验证，应继续明确要求不修改文件、不创建提交、不打开 PR，并在报告末尾运行 `git status --short`。

环境或 lockfile 发生实质变化时，应重新运行一次完整门禁；只有 Cloud 任务实际完成且逐项退出状态可检查，才写成“Cloud 已验证”。本地 `origin`、GitHub CLI 登录、CI 通过或仅能列出 Cloud 任务都不能单独替代这项证据。
