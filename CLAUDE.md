# Bubbles — Repository guide for AI assistants

## What this is

**Bubbles** is a desktop Electron app: a pixel-art pet and multi-agent AI workstation. This repo is a **pnpm + Turborepo** monorepo. Phase 1 established tooling only; feature work starts in Phase 2.

## Stack (locked)

- Electron 32+, React 19, TypeScript 5.6, Vite 6, Tailwind 4, pnpm 10, Turborepo 2
- Biome (lint/format), Vitest (unit), Playwright (E2E with Electron)
- Zod-first boundaries; local SQLite + MiniMax in later phases

## Where things live

| Area | Path |
|------|------|
| Electron main + preload | `apps/desktop/src/main`, `apps/desktop/src/preload` |
| React UI | `apps/renderer/src` |
| IPC / agent / message Zod schemas | `packages/shared-types/src` (Phase 2+) |
| Structured logging | `packages/shared-logger` |
| Agent loop / registry | `packages/agent-runtime` |
| SQLite + DAO | `packages/memory-core` |
| MiniMax API client | `packages/minimax-client` |
| Built-in tools | `packages/tool-kit` |
| Permission / preview flow | `packages/permission-guard` |
| Cost / usage metering | `packages/cost-meter` |
| Composer prompt templates | `.cursor/prompts/` |
| E2E scenarios (plain English) | `tests/e2e/scenarios.md` |
| Agent eval dataset | `tests/agent-eval/dataset.jsonl` |
| CI workflows | `.github/workflows/` |

## Common commands (repo root)

```bash
pnpm install          # install all workspace deps (+ Electron binary via postinstall)
pnpm dev:desktop      # Electron + renderer (electron-vite)
pnpm dev:renderer     # Vite dev server for UI only
pnpm typecheck        # all packages via Turborepo
pnpm lint             # Biome check
pnpm test             # Vitest in all packages
pnpm test:coverage    # Vitest with coverage (target 70% on packages in later phases)
pnpm e2e              # Playwright (builds desktop first)
pnpm verify           # typecheck + lint + test (see scripts/verify.ts)
pnpm eval             # LLM-as-judge harness (no-op / empty dataset until Phase 4)
```

## Package list (one-liners)

- **@bubbles/desktop** — Electron shell: windows, IPC wiring, audio (later).
- **@bubbles/renderer** — React UI: avatar, chat, settings (later).
- **@bubbles/shared-types** — Zod schemas and inferred types for IPC and payloads.
- **@bubbles/shared-logger** — Pino-based logger with correlation IDs (`turnId`).
- **@bubbles/agent-runtime** — Agent registry, SkillsCompiler, AgentLoop (Phase 4+).
- **@bubbles/memory-core** — SQLite schema, migrations, DAO-only DB access.
- **@bubbles/minimax-client** — M2.7 chat, TTS, auth from `safeStorage` (Phase 2+).
- **@bubbles/tool-kit** — Built-in tools + registry + zod-to-json-schema exports.
- **@bubbles/permission-guard** — `review()` pipeline and persistence hooks.
- **@bubbles/cost-meter** — Records usage to `cost_events` / reporting helpers.

## Rules of engagement

1. Read the relevant **`CLAUDE.md`** in the package you touch before editing.
2. Follow **`.cursorrules`** at the repo root.
3. Prefer **small PR-sized diffs** and co-located tests.
4. Renderer **never** imports Node built-ins or `electron`; use the preload bridge only.

## Docs

- POC dev plan: `docs/my-idea-is-called-fluffy-torvalds-PoC-dev-plan.md`
- Technical plan: `docs/my-idea-is-called-fluffy-torvalds.md`
