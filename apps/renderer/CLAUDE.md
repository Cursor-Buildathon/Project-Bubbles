# @bubbles/renderer

## Purpose

**React 19 + Vite + Tailwind** renderer: avatar (PixiJS later), chat, settings, permission modals — all via preload bridge only.

## Public exports

N/A — application UI. Entry: `src/main.tsx`.

## Invariants

- Never import Node built-ins or `electron` directly — only `window` APIs exposed from preload.
- Keep animation-heavy code isolated (Pixi canvas) to avoid React churn (Phase 3).

## Forbidden

- No direct `fetch` to MiniMax — main process owns keys and network to MiniMax.

## Run tests

`pnpm --filter @bubbles/renderer test`

## Run dev (UI only)

`pnpm --filter @bubbles/renderer dev`
