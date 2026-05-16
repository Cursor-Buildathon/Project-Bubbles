# Debugging And Tooling

Last updated: 2026-05-16

## Verification Commands

- `npm run test:core`
- `npm run test:desktop`
- `npm run typecheck:core`
- `npm run typecheck:desktop`
- `npm test`
- `npm run typecheck`

## Tavily Research Debugging

Tavily research is implemented with injectable core services:

- `createTavilySetupService` verifies and resets the Tavily API key.
- `createTavilyRemoteMcpClient` performs Remote MCP `tools/call` requests.
- `createTavilyResearchConnector` calls `tavily-search` and `tavily-extract`.
- `createResearchService` asks MiniMax to synthesize cited reports and follow-up answers.

Tests should inject a fake `TavilyMcpClientLike`. Do not restore the removed `mcp:search-fixture` script, generic command MCP client, or Google Workspace connector helpers.

## Voice Debugging

Voice input should produce one final English transcript per turn, and English MiniMax TTS should speak one response per turn. Wake phrase mode listens for `Hi Bubbles` and submits the remaining command text.

## Secret Handling

MiniMax, Tavily, Gemini, and OpenAI keys must remain redacted in errors, trace events, task logs, memory, and exported logs.
