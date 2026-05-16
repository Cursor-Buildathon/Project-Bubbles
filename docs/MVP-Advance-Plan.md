# MVP Advance Plan

Last updated: 2026-05-16

## Current Direction

Bubbles uses direct provider APIs instead of CLI bridges:

- MiniMax Token Plan APIs for text, JSON, tasks, TTS, image, and music.
- Tavily Remote MCP for live research.
- Gemini STT with optional OpenAI fallback.
- MiniMax TTS for voice playback.

## Research Workflow

- Trigger phrases: `do me a research`, `do research`, `search me`, `search for`, `look up`, `investigate`, `find sources`.
- Tavily searches and extracts source pages.
- MiniMax synthesizes the comprehensive report.
- Chat shows the full output.
- Voice uses the shared spoken-response policy: short replies are spoken directly, and reports or long follow-up answers say `Please look in the chat panel for the response.`
- Follow-up questions use the latest report context.

## Removed Scope

Do not rebuild removed MiniMax CLI, generic MCP command launchers, MCP fixtures, Gmail, Calendar, Local Files, or Google Workspace connector paths.
