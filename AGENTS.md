# Codex execution guide

## Authority

Read these before changing product behavior or content:

1. `docs/01_别忘了_产品定义与冻结规格_V1.1.md`
2. `docs/02_别忘了_官方模板内容库_V1.1.md`
3. `docs/03_Codex_别忘了_双端开发_任务书_V1.1.md`
4. `contracts/domain-contract-cases.v1.1.json`

The Markdown content library is authoritative over generated template JSON. Do not rewrite official copy from model judgment.

## Runtime

- Node.js 24.x
- pnpm 11.19.0

## Setup and verification

```bash
pnpm runtime:check
pnpm install --frozen-lockfile
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:boundaries
pnpm miniprogram:verify
```

Use `pnpm e2e` only after the Playwright Chrome channel is installed. In a fresh Linux or Codex Cloud environment, install it with:

```bash
pnpm --filter @biewangle/pwa exec playwright install --with-deps chrome
pnpm e2e
```

`pnpm miniprogram:verify` is the offline native WeChat static release gate. Official WeChat compilation, preview, upload, review and release require the macOS developer tools and the appropriate WeChat account permissions.

## Codex Cloud

- Pin Node.js 24 in the environment; the repository pins it in `.nvmrc`, rejects other majors through `engines.node`, and pins pnpm 11.19.0 in `packageManager`.
- The setup command is `pnpm install --frozen-lockfile` once pnpm is available.
- No repository secret or product runtime environment variable is required.
- Read `README.md` and `docs/deployment/codex-cloud.md` before changing deployment state.
- Treat `evidence/requirements-matrix.md` as the acceptance index and update evidence only from commands or terminal actions actually executed.

## Non-negotiable behavior

- Never mark a run completed while any item is unchecked.
- Never mutate a source template from run-local state.
- Persist core operations durably before presenting success.
- Keep PWA and WeChat UI implementations separate; share only domain contracts, content, and fixtures.
- No product account, cloud sync, AI, analytics, ads, remote fonts, or required runtime CDN.
