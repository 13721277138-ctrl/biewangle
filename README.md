# 别忘了 · V1.1

“别忘了”是一个无账号、Local-first、离线可用的安心检查清单。它帮助用户把“我是不是漏了什么”变成一份可以逐项确认、诚实结束、随时恢复的本地事实记录。

- PWA：<https://13721277138-ctrl.github.io/biewangle/>
- GitHub：<https://github.com/13721277138-ctrl/biewangle>
- 微信端：独立原生小程序工程，当前推进到测试号体验构建；不声称正式发布。
- 产品版本：`1.1.0`

## 信任边界

- 核心数据只保存在当前浏览器或微信小程序本地存储中，不自动上传、同步或合并。
- 没有产品账号、云数据库、AI、Analytics、广告、远程字体或运行时必需 CDN。
- Run 使用启动时冻结快照；本次勾选、`notNeeded`、临时项、排序和一次性备注不会反写模板，也不会继承到新 Run。
- 只在全部项目均已处理时允许 `completed`；存在未处理项只能诚实结束为 `endedWithUnresolved`，或明确放弃。
- JSON 恢复、迁移、重置和普通写入都先保护现有事实，失败不会伪装成功。

完整冻结规格以这些文件为准：

1. [`docs/01_别忘了_产品定义与冻结规格_V1.1.md`](docs/01_别忘了_产品定义与冻结规格_V1.1.md)
2. [`docs/02_别忘了_官方模板内容库_V1.1.md`](docs/02_别忘了_官方模板内容库_V1.1.md)
3. [`docs/03_Codex_别忘了_双端开发_任务书_V1.1.md`](docs/03_Codex_别忘了_双端开发_任务书_V1.1.md)
4. [`contracts/domain-contract-cases.v1.1.json`](contracts/domain-contract-cases.v1.1.json)

官方 Markdown 内容库高于派生 JSON；不要凭主观改写官方模板文案。

## 工程结构

```text
packages/domain/               shared 领域模型、快照、备份与迁移
packages/persistence-contract/ 持久化提交、恢复、迁移与写入版本合同
shared-content/                冻结内容的派生产物
pwa/                           React / TypeScript / IndexedDB PWA
miniprogram/                   独立 WXML / WXSS / JavaScript 微信小程序
contracts/                     官方模板与跨端 Golden Fixtures
tests/                         内容、跨端、微信、边界与安全门禁
evidence/                      命令、浏览器、模拟器与发布证据
docs/deployment/               PWA、微信和 Codex Cloud 操作边界
```

PWA 与微信 UI 分开实现；只共享领域合同、内容和测试 fixture，不使用 `web-view` 复用网页。

## 本地启动

需要 Node.js 24.x 与 pnpm 11.19.0。

```sh
pnpm runtime:check
pnpm install --frozen-lockfile
pnpm --filter @biewangle/pwa dev
```

浏览器打开 <http://127.0.0.1:4173/>。生产预览：

```sh
pnpm build
pnpm --filter @biewangle/pwa preview
```

微信开发者工具导入仓库内的 `miniprogram/`；测试、体验与生产 AppID 的边界见 [`docs/deployment/wechat.md`](docs/deployment/wechat.md)。

## 完整验证

```sh
pnpm install --frozen-lockfile
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:boundaries
pnpm miniprogram:verify
pnpm e2e
```

全新 Linux / Codex Cloud 环境运行 E2E 前安装 Chrome：

```sh
pnpm --filter @biewangle/pwa exec playwright install --with-deps chrome
```

GitHub 的 `Verify repository` 工作流在所有 push 和 pull request 上执行同一组门禁；`Verify and deploy PWA` 只允许 `main` 在全门禁通过后部署 GitHub Pages。

## 发布与复现

- PWA 构建与公网复验：[`docs/deployment/pwa.md`](docs/deployment/pwa.md)
- 微信编译、预览、体验版与正式发布边界：[`docs/deployment/wechat.md`](docs/deployment/wechat.md)
- Codex Cloud 仓库环境：[`docs/deployment/codex-cloud.md`](docs/deployment/codex-cloud.md)
- P0 / P1 与 26 项不变量证据索引：[`evidence/requirements-matrix.md`](evidence/requirements-matrix.md)
- 最终真实交付状态：[`evidence/final-delivery-report.md`](evidence/final-delivery-report.md)

未完成的账号、真机或平台动作会被明确标成外部阻塞，不会由 build、模拟器或文档替代。

## 数据与隐私提醒

Local-first 不等于设备永不丢失。浏览器或微信可能因系统清理、卸载、存储压力或设备故障而丢失本地数据；请定期生成完整 JSON 备份，并把文件真实保存到另一位置。普通清单分享默认不包含 `oneTimeNote`。
