# @bubbles/shared-types

## Purpose

Single source of truth for **Zod schemas** and inferred TypeScript types crossing package boundaries (IPC, MiniMax payloads, agent shapes).

## Public exports

- `ipc` schemas (Phase 2) — versioned channels like `v1:agent:run`.
- `agent`, `message`, `memory` schemas — as the POC adds real shapes.

## Invariants

- Every IPC channel has request + response Zod schemas; invalid payloads fail loudly at runtime.
- Channel names use the `v1:` prefix (Foundation Enabler #8).

## Forbidden

- No runtime I/O here — types and schemas only.
- No `any`; no `console.log`.

## Run tests

`pnpm --filter @bubbles/shared-types test`
