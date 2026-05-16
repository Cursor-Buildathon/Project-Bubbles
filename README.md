# Bubbles (PoC)

Desktop pet + multi-agent AI workstation. This repo is a **pnpm + Turborepo** monorepo.

## Prerequisites

- Node 22+ (see `.nvmrc`)
- pnpm 10 (`corepack enable` or install from pnpm.io)
- Windows (primary target; macOS supported for dev)

## Setup

```bash
pnpm install
```

The root `postinstall` runs Electron's `install.js` and selects the correct `better-sqlite3` native binary.

## First Run

```bash
pnpm dev:desktop
```

1. Complete the 3-step onboarding wizard (API key, workspace folder)
2. Bubbles appears on your desktop
3. Click the avatar or press `Ctrl+Space` to open chat

## Common Commands

| Command | Purpose |
|--------|---------|
| `pnpm dev:desktop` | Electron + renderer (electron-vite) |
| `pnpm dev:renderer` | Vite dev server for UI only |
| `pnpm typecheck` | TypeScript across all workspaces |
| `pnpm lint` | Biome check |
| `pnpm lint:fix` | Biome check + write fixes |
| `pnpm test` | Vitest (all packages) |
| `pnpm test:coverage` | Vitest + coverage (70% threshold) |
| `pnpm e2e` | Build desktop + Playwright E2E |
| `pnpm eval` | Agent-eval harness (deterministic by default) |
| `pnpm eval:ci` | Agent-eval in CI mode |
| `pnpm package:win` | Build Windows NSIS installer |
| `pnpm package:mac` | Build macOS DMG (unsigned) |
| `pnpm verify` | Full CI pipeline: typecheck + lint + test + e2e |
| `pnpm verify:quick` | typecheck + lint + test (no e2e) |
| `pnpm bubbles:doctor` | Environment health check |

## Test Mode

Run the app without live MiniMax API calls:

```bash
BUBBLES_TEST_MODE=1 pnpm dev:desktop
BUBBLES_TEST_MODE=1 pnpm e2e
```

In test mode, chat returns deterministic canned responses and TTS emits silent MP3 frames.

## Architecture

```
apps/desktop/     — Electron main + preload
apps/renderer/    — React 19 + Tailwind 4 UI
packages/
  shared-types/   — Zod IPC schemas
  shared-logger/  — Pino structured logging
  agent-runtime/  — Agent registry, SkillsCompiler, AgentLoop
  memory-core/    — SQLite + DAOs
  minimax-client/ — MiniMax M2.7 chat + Speech-02-Turbo TTS
  tool-kit/       — Built-in tools (readFile, writeFile, listDir, plan_mode)
  permission-guard/ — Review pipeline for tool calls
  cost-meter/     — Usage tracking
```

## Agents

Three preset agents ship with the app:

| Agent | Role | Tools |
|-------|------|-------|
| **Bubbles** | General assistant | readFile, listDir |
| **Coda** | Coding partner | readFile, writeFile, listDir, plan_mode |
| **Sage** | Research analyst | readFile |

Agents are filesystem-driven: `~/.bubbles/agents/<id>/config.json` + `skills.md`.

## Packaging

```bash
pnpm package:win   # → apps/desktop/release/Bubbles Setup.exe
```

The Windows installer is unsigned by default. Set `CSC_LINK` and `CSC_KEY_PASSWORD` env vars for code signing.

## Docs

- `docs/Poc-Phase6-Ship.md` — Phase 6 hardening & shipping details
- `docs/my-idea-is-called-fluffy-torvalds-PoC-dev-plan.md` — phased dev plan
- `docs/my-idea-is-called-fluffy-torvalds.md` — technical architecture
- `CLAUDE.md` — AI / contributor guide

## License

Private / TBD.
