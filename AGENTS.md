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
pnpm install --frozen-lockfile
pnpm content:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm e2e` only after Playwright browsers are installed. Use `pnpm miniprogram:verify` for the native WeChat project static gate.

## Non-negotiable behavior

- Never mark a run completed while any item is unchecked.
- Never mutate a source template from run-local state.
- Persist core operations durably before presenting success.
- Keep PWA and WeChat UI implementations separate; share only domain contracts, content, and fixtures.
- No product account, cloud sync, AI, analytics, ads, remote fonts, or required runtime CDN.
