# @bubbles/shared-logger

## Purpose

Structured logging with **correlation IDs** (`turnId`) for tracing a user turn across main, IPC, and MiniMax calls (Foundation Enabler #10).

## Public exports

- `createLogger(scope)` — returns a child logger with bound context.
- `withTurn(turnId, fn)` — async context helper (Phase 2+).

## Invariants

- Main process uses pino-compatible JSON logs; never log secrets or raw API keys.
- Replace ad-hoc `console.log` in application code with this package.

## Forbidden

- No logging from renderer — renderer uses UI feedback or IPC to main for diagnostics.

## Run tests

`pnpm --filter @bubbles/shared-logger test`
