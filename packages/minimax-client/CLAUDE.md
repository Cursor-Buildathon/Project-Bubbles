# @bubbles/minimax-client

## Purpose

Typed **MiniMax** client: M2.7 streaming chat (tools), Speech-02 TTS, backoff on 429, cost metadata for `@bubbles/cost-meter`.

## Public exports

- `createChatClient` / streaming parsers (Phase 2).
- `createTtsClient` — Speech-02-Turbo / HD (Phase 2).
- `readApiKey` / `auth` — from Electron `safeStorage` in main only.

## Invariants

- All outbound model/TTS traffic goes through this package — single place to patch API drift.
- Tag requests with `turnId` / correlation headers for tracing.

## Forbidden

- No direct `fetch` to MiniMax from other packages.
- No logging of API keys or raw auth headers.

## Run tests

`pnpm --filter @bubbles/minimax-client test`
