---
name: bubbles-debugging
description: Use when debugging Bubbles MVP bugs, failing tests, stalled MiniMax CLI tasks, connector failures, Electron IPC issues, sqlite persistence, renderer state, avatar behavior, or setup problems.
---

# Bubbles Debugging

## First Pass

1. Reproduce with the narrowest command:
   - Core logic: `npm run test:core -- <test-file-or-pattern>`
   - Desktop renderer or avatar: `npm run test:desktop -- <test-file-or-pattern>`
   - Types: `npm run typecheck:core` or `npm run typecheck:desktop`
2. Trace the boundary that owns the symptom:
   - User action or visible UI: `apps/desktop/src/renderer`
   - Renderer API mismatch: `apps/desktop/src/main/preload.ts`
   - IPC registration or app state: `apps/desktop/src/main`
   - Business logic: `packages/core/src`
   - CLI execution: `packages/core/src/cli` and `apps/desktop/src/main/ipc/taskIpc.ts`
   - Connectors/MCP: `packages/core/src/connectors`
   - MiniMax setup/API/CLI: `packages/core/src/minimax` and `apps/desktop/src/main/ipc/setupIpc.ts`
3. Read the relevant test before editing. Most services already have focused Vitest coverage.

## Evidence Checklist

- Capture the exact failing command and error.
- Check whether the issue appears in core tests, desktop tests, typecheck, Electron runtime, or only packaged runtime.
- For multi-layer issues, log or inspect data at each boundary: renderer state, preload API, IPC handler, core service input, external command result, and persisted sqlite state.
- For secrets or credentials, verify only presence/status. Never print raw MiniMax keys, token-plan keys, connector env values, or task packet secrets.

## Common Paths

- Stalled task: inspect `createCliBridge`, parser behavior, timeout handling, and `preflightMiniMaxCli`.
- Bad task result: inspect `cliEventParser`, `extractMiniMaxResponseText`, `createMiniMaxCommand`, and task drawer rendering.
- Setup cannot finish: inspect `setupService`, `minimaxCliManager`, key store calls, and IPC status broadcasts.
- Connector unavailable: inspect connector registry state, mode, auth status, launch config, fixture fallback, and health check logic.
- Renderer mismatch: inspect `global.d.ts`, `preload.ts`, component props/state, and `App.test.tsx`.
- Persistence issue: inspect sqlite store tests, schema SQL, `persist()` calls, and app `userData` database paths.

## Verification

Before saying a bug is fixed, run the focused test that would have caught it, then the affected package typecheck. For cross-boundary fixes, also run `npm test` and `npm run typecheck`.
