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
- Voice only announces that the output is ready unless the user asks to read it aloud.
- Follow-up questions use the latest report context.

## Removed Scope

Do not rebuild removed MiniMax CLI, generic MCP command launchers, MCP fixtures, Gmail, Calendar, Local Files, or Google Workspace connector paths.
