# Bubbles — Repository guide for AI assistants

## What this is

**Bubbles** is a desktop Electron app: a pixel-art pet and multi-agent AI workstation. This repo is a **pnpm + Turborepo** monorepo. Phase 1–5 are complete; Phase 6 (harden, test, ship) is in progress.

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
pnpm eval             # LLM-as-judge harness (no-op / empty dataset until Phase 6)
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

1. Read the relevant **`AGENTS.md`** in the package you touch before editing.
2. Follow **`.cursorrules`** at the repo root.
3. Prefer **small PR-sized diffs** and co-located tests.
4. Renderer **never** imports Node built-ins or `electron`; use the preload bridge only.

## AI Assistant Infrastructure (`.cursor/`)

### Skills (reusable capabilities)

| Skill | Path | Use When |
|-------|------|----------|
| `bubbles-debugging` | `.cursor/skills/bubbles-debugging/` | General triage of build, test, CI, or Electron failures |
| `bubbles-agent-tool` | `.cursor/skills/bubbles-agent-tool/` | Adding or reviewing built-in tools in `packages/tool-kit` |
| `bubbles-ipc-preload` | `.cursor/skills/bubbles-ipc-preload/` | Adding, debugging, or reviewing IPC channels and preload bridge |
| `bubbles-native-sqlite` | `.cursor/skills/bubbles-native-sqlite/` | better-sqlite3 ABI issues, native binary management |
| `bubbles-e2e-testing` | `.cursor/skills/bubbles-e2e-testing/` | Playwright E2E tests, visual regression, Electron window lifecycle |
| `bubbles-vscode-debug` | `.cursor/skills/bubbles-vscode-debug/` | Setting up VS Code debugging for main/renderer processes |
| `bubbles-build-packaging` | `.cursor/skills/bubbles-build-packaging/` | electron-builder, native module bundling, release packaging |
| `bubbles-agent-eval` | `.cursor/skills/bubbles-agent-eval/` | LLM-as-judge harness, eval dataset, scoring agent outputs |
| `bubbles-renderer-testing` | `.cursor/skills/bubbles-renderer-testing/` | React component tests with Vitest + happy-dom |

### Agents (review briefs)

| Agent | Path | Use When |
|-------|------|----------|
| `feature-test-planner` | `.cursor/agents/feature-test-planner.md` | Planning test coverage for a new feature |
| `ipc-consistency-reviewer` | `.cursor/agents/ipc-consistency-reviewer.md` | Reviewing IPC contract changes across shared-types, main, preload, renderer |
| `native-dependency-auditor` | `.cursor/agents/native-dependency-auditor.md` | Electron/Node/pnpm/better-sqlite3 version or ABI changes |
| `e2e-failure-investigator` | `.cursor/agents/e2e-failure-investigator.md` | Playwright E2E test failures in CI or locally |
| `renderer-bug-hunter` | `.cursor/agents/renderer-bug-hunter.md` | Renderer process crashes, blank screens, UI bugs |
| `native-module-fix` | `.cursor/agents/native-module-fix.md` | better-sqlite3 loading failures, ABI mismatches |

### Prompts (Composer templates)

| Prompt | Path | Purpose |
|--------|------|---------|
| `new-tool` | `.cursor/prompts/new-tool.md` | Add a built-in agent tool |
| `new-ipc-channel` | `.cursor/prompts/new-ipc-channel.md` | Add a versioned IPC channel with Zod |
| `new-package` | `.cursor/prompts/new-package.md` | Scaffold a new workspace package |
| `new-agent-preset` | `.cursor/prompts/new-agent-preset.md` | Add a filesystem-backed agent preset |
| `gen-tests` | `.cursor/prompts/gen-tests.md` | Generate Vitest suites for a source file |
| `gen-e2e` | `.cursor/prompts/gen-e2e.md` | Convert a scenario into a Playwright spec |
| `fix-e2e-smoke` | `.cursor/prompts/fix-e2e-smoke.md` | Repair the failing E2E smoke test |
| `debug-renderer-crash` | `.cursor/prompts/debug-renderer-crash.md` | Diagnose renderer process crashes |
| `add-visual-test` | `.cursor/prompts/add-visual-test.md` | Add visual regression tests |

### Rules (auto-applied constraints)

| Rule | Path | Applies To |
|------|------|------------|
| `ipc-contracts` | `.cursor/rules/ipc-contracts.mdc` | shared-types, main IPC, preload, renderer |
| `native-sqlite-electron` | `.cursor/rules/native-sqlite-electron.mdc` | desktop, memory-core, sqlite scripts |
| `package-layering` | `.cursor/rules/package-layering.mdc` | all `apps/` and `packages/` |
| `renderer-boundary` | `.cursor/rules/renderer-boundary.mdc` | `apps/renderer/src/` |

## Docs

- POC dev plan: `docs/my-idea-is-called-fluffy-torvalds-PoC-dev-plan.md`
- Technical plan: `docs/my-idea-is-called-fluffy-torvalds.md`
