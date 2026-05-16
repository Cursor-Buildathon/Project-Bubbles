# Full Plan V2

Last updated: 2026-05-16

## Architecture

- Direct MiniMax Token Plan APIs for assistant tasks and creative media.
- Tavily Remote MCP as the only connector-backed web research provider.
- Gemini/OpenAI STT and MiniMax TTS for voice.
- SQLite stores for memory, timeline, connectors, and approvals.
- Human approval remains for sensitive local file or shell actions.

## Research

Bubbles should understand `do me a research` and `search me`, run Tavily search/extract, synthesize a cited MiniMax report, show it in chat, and preserve it for follow-up questions.

## Non-Goals

Removed systems should stay removed: MiniMax CLI bridge, generic MCP command connectors, MCP fixtures, Gmail/Calendar/Local Files connectors, and Google Workspace setup.
