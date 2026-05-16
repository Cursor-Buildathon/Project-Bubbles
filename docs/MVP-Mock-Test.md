# MVP Smoke Test

Last updated: 2026-05-16

## Setup

- MiniMax Token Plan key is saved and verified.
- Tavily API key is saved, `Tavily Research` is enabled, and connector health is healthy.
- Gemini STT works; OpenAI STT fallback is recommended so smoke runs can continue when Gemini free-tier quota is exhausted.
- MiniMax TTS works.

## Voice

- Say `Hi Bubbles, search me Tavily MCP`.
- Confirm only one transcript appears and only one TTS response plays.
- Confirm Bubbles says only the ready message for research output.

## Research

- Send `do me a research on MiniMax Token Plans`.
- Confirm a comprehensive report appears in chat with source citations.
- Ask a follow-up question and confirm the answer uses the latest report context.
- Ask `read the research output` and confirm full report playback happens only after this explicit request.

## Removed Paths

The smoke test must not exercise old Web Search, Local Files, Email, Calendar, Google Workspace, generic MCP command, MCP fixture, or MiniMax CLI flows.

## Verification

- `npm run test:core`
- `npm run test:desktop`
- `npm run typecheck:core`
- `npm run typecheck:desktop`
