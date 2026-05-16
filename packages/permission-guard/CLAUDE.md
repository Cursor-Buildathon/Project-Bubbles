# @bubbles/permission-guard

## Purpose

**Permission & safety**: every tool call passes `Guard.review(call)` before execution; decisions are logged for audit (Foundation Enabler #4).

## Public exports

- `Guard.review(call) => Promise<Decision>` — whitelist / preview / remember cascade.
- Policy types — `allow`, `deny`, `pending` (awaiting renderer approval).

## Invariants

- No tool executes in main until the guard resolves (except explicitly auto-allowed reads).
- Persist `permissions` rows when DB is available (wired in Phase 2+).

## Forbidden

- No MiniMax calls.
- No direct file system access — tools perform I/O; guard only decides.

## Run tests

`pnpm --filter @bubbles/permission-guard test`
