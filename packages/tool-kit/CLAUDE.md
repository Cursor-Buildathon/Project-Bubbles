# @bubbles/tool-kit

## Purpose

Built-in **agent tools**: file read/write, plan mode, code runner (later), each with Zod schemas and JSON-schema export for MiniMax tool arrays.

## Public exports

- `Tool` interface — `name`, `schema`, `invoke`, `requiresApproval`.
- `registry` — register tools; `forAgent(agent)` filters by whitelist.

## Invariants

- Tool definitions use Zod + `zod-to-json-schema` for model-facing schemas.
- Writes and destructive actions set `requiresApproval: true` unless policy explicitly auto-allows.

## Forbidden

- No bypassing `@bubbles/permission-guard` for writes or external side effects.

## Run tests

`pnpm --filter @bubbles/tool-kit test`
