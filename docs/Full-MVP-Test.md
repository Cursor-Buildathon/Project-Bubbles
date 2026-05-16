# Full MVP Test

Last updated: 2026-05-16

## Required Coverage

- MiniMax Token Plan setup and reset.
- Tavily setup, reset, connector enable, health check, research routing, and follow-up answers.
- Voice setup with Gemini STT, optional OpenAI STT fallback, MiniMax TTS, and `Hi Bubbles` wake phrase.
- Direct MiniMax task runner lifecycle, cancellation, redacted logs, memory extraction, timeline persistence, and Task Drawer rendering.
- Direct MiniMax image/music generation plus deterministic media fixture artifacts in CI/demo mode.
- Agent birth and approval-gated file creation.

## Research Acceptance

- `do me a research ...` and `search me ...` start a Tavily Remote MCP search.
- The full report appears in chat.
- TTS speaks only the ready message unless the user asks to read the report.
- Follow-up questions use the latest report context.

## Removed Coverage

Do not test removed Gmail, Calendar, Local Files, generic Web Search fixture, MCP command launcher, Google Workspace OAuth setup, or MiniMax CLI flows.

## Commands

- `npm test`
- `npm run typecheck`
