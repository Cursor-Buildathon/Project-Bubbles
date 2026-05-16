# MVP Smoke Test Status

Last updated: 2026-05-16

Current target: Tavily-only research workflow with direct MiniMax APIs and direct voice providers.

## Completed Expectations

- MiniMax CLI bridge removed.
- MiniMax Token Plan key is the only MiniMax credential flow.
- Gemini STT and MiniMax TTS are active; OpenAI STT fallback is recommended for quota-safe smoke runs.
- `Hi Bubbles` wake phrase is supported.
- Tavily API key setup and Tavily Research connector are the only connector-backed research path.
- MCP fixture and Google Workspace connector paths are removed.

## Current Smoke Focus

- One STT final transcript per voice turn.
- One TTS response per assistant turn.
- Research output appears in chat and is not read aloud unless requested.
- Follow-up questions continue from the latest research report.
