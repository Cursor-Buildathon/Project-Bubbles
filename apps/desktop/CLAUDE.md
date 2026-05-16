# @bubbles/desktop

## Purpose

**Electron main process** and **preload**: window lifecycle, IPC handlers, native integrations (audio, tray), orchestrates packages in main.

## Public exports

N/A — this is an application package, not a library. Entry: `src/main/index.ts`, preload: `src/preload/index.ts`.

## Invariants

- Electron **main** must bundle workspace `@bubbles/*` packages via `externalizeDepsPlugin({ exclude: [...] })` so Node never loads raw `.ts` at runtime.
- `better-sqlite3` must remain external (`rollupOptions.external`) in the main bundle — `bindings` uses `__dirname` relative lookups that break when inlined.
- Two `better-sqlite3` prebuilts are needed: `electron-v128` for the app runtime and the current Node ABI for Vitest. Root `postinstall` runs `scripts/select-sqlite-binary.mjs`; `scripts/fix-better-sqlite3.mjs` can refresh cached binaries. `packages/memory-core/vitest.globalSetup.ts` swaps binaries before/after tests.
- Use `contextBridge` + typed surface; never enable `nodeIntegration` in renderer.
- All IPC payloads validated with `@bubbles/shared-types` schemas (Phase 2).

## Forbidden

- No UI in main — React lives in `@bubbles/renderer`.
- No `console.log` — use `@bubbles/shared-logger`.

## Run tests

`pnpm --filter @bubbles/desktop test`

## Run dev

`pnpm --filter @bubbles/desktop dev` (or `pnpm dev:desktop` from root)
