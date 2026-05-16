# @bubbles/memory-core

## Purpose

**SQLite** (better-sqlite3) with migrations and a **DAO layer** — the only package allowed to execute SQL (Foundation Enabler #2).

## Public exports

- Migration runner — apply on app start.
- DAO modules — `projects`, `agents`, `conversations`, `messages`, `memories`, `permissions`, `cost_events`, etc.

## Invariants

- No raw SQL outside this package; consumers use DAO functions only.
- Schema includes headroom: embeddings column nullable, timeline, permissions, files.

## Forbidden

- No MiniMax calls — higher layers orchestrate recall/embeddings.
- No renderer imports.

## Run tests

`pnpm --filter @bubbles/memory-core test`
