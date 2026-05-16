# Bubbles (PoC)

Desktop pet + multi-agent AI workstation. This repo is a **pnpm + Turborepo** monorepo (Phase 1: tooling and scaffold only).

## Prerequisites

- Node 22+ (see `.nvmrc`)
- pnpm 10 (`corepack enable` or install from pnpm.io)

## Setup

```bash
pnpm install
```

The root `postinstall` runs Electron’s `install.js` so the OS-specific binary is present (required for `pnpm dev:desktop` and E2E).

## Common commands

| Command | Purpose |
|--------|---------|
| `pnpm dev:desktop` | Electron + renderer (electron-vite) |
| `pnpm dev:renderer` | Vite dev server for UI only |
| `pnpm typecheck` | TypeScript across all workspaces |
| `pnpm lint` | Biome |
| `pnpm test` | Vitest (all packages) |
| `pnpm test:coverage` | Vitest + coverage |
| `pnpm e2e` | Build desktop + Playwright smoke |
| `pnpm verify` | typecheck + lint + test + e2e |
| `pnpm eval` | Agent-eval harness (empty dataset until Phase 4) |

## Docs

- `docs/my-idea-is-called-fluffy-torvalds-PoC-dev-plan.md` — phased dev plan  
- `docs/my-idea-is-called-fluffy-torvalds.md` — technical architecture  
- `CLAUDE.md` — AI / contributor guide  

## License

Private / TBD.
