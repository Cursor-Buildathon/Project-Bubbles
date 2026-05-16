# @bubbles/cost-meter

## Purpose

Record **token / character / call** usage to SQLite `cost_events` and expose helpers for Settings spend views (Foundation Enabler #5).

## Public exports

- `recordCostEvent(input)` — idempotent-friendly insert (Phase 2).
- Reporting helpers — aggregates by day/week/month.

## Invariants

- Every MiniMax chat/TTS completion should emit a cost row via this package (called from minimax-client or agent-runtime, not scattered).

## Forbidden

- No model inference here — accounting only.

## Run tests

`pnpm --filter @bubbles/cost-meter test`
