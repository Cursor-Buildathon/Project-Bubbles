# @bubbles/desktop

## Purpose

**Electron main process** and **preload**: window lifecycle, IPC handlers, native integrations (audio, tray), orchestrates packages in main.

## Public exports

N/A — this is an application package, not a library. Entry: `src/main/index.ts`, preload: `src/preload/index.ts`.

## Invariants

- Electron **main** must bundle workspace `@bubbles/*` packages (or ship compiled `.js`). `externalizeDepsPlugin({ exclude: ["@bubbles/shared-logger", ...] })` in `electron.vite.config.ts` so Node never loads raw `.ts` from `packages/*` at runtime.
- Use `contextBridge` + typed surface; never enable `nodeIntegration` in renderer.
- All IPC payloads validated with `@bubbles/shared-types` schemas (Phase 2).

## Forbidden

- No UI in main — React lives in `@bubbles/renderer`.
- No `console.log` — use `@bubbles/shared-logger`.

## Run tests

`pnpm --filter @bubbles/desktop test`

## Run dev

`pnpm --filter @bubbles/desktop dev` (or `pnpm dev:desktop` from root)
