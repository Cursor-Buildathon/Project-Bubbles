# Full Plan V2

Last updated: 2026-05-16

## Architecture

- Direct MiniMax Token Plan APIs for assistant tasks and creative media.
- Tavily Remote MCP as the only connector-backed web research provider.
- Gemini/OpenAI STT and MiniMax TTS for voice.
- Shared spoken-response policy keeps TTS short: under 50 normalized characters are spoken, and longer replies point to chat.
- SQLite stores for memory, timeline, connectors, and approvals.
- Human approval remains for sensitive local file or shell actions.

## Research

Bubbles should understand `do me a research` and `search me`, run Tavily search/extract, synthesize a cited MiniMax report, show it in chat, preserve it for follow-up questions, and use the chat-panel voice prompt instead of reading long reports aloud.

## Non-Goals

Removed systems should stay removed: MiniMax CLI bridge, generic MCP command connectors, MCP fixtures, Gmail/Calendar/Local Files connectors, and Google Workspace setup.
