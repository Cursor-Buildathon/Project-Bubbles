---
name: bubbles-tooling-mcp
description: Use when configuring or debugging Bubbles MVP Tavily Remote MCP research, connector IPC/setup, external-tool approval flows, local diagnostic scripts, Codex Browser, Computer Use, or Lazyweb. Do not use for removed generic MCP fixture connectors, Google Workspace, Gmail, Calendar, Local Files, or MiniMax CLI paths except to remove stale references.
---

# Bubbles Tooling And MCP

## Available Debug Tools

- `npm test` and `npm run typecheck`: full verification.
- `npm run test:core`, `npm run test:desktop`: package-scoped tests.
- `npm run typecheck:core`, `npm run typecheck:desktop`: package-scoped typechecks.
- `npm run audit:capabilities`: print current IPC, env flags, agents, task types, connector ids, and root scripts.
- `npm run audit:fixtures`: find fixture/static/demo signals and declared tool/event surfaces without executors.
- `npm run doctor`: run both local audits.
- `npm run dev`: Electron Vite development runtime.
- Browser plugin: local renderer/browser verification when a local URL is available.
- Computer Use plugin: real Electron window inspection and interaction.
- Lazyweb plugin: UI reference research when improving visual design.

## Bubbles Connector Model

The shipped connector model is intentionally narrow:

- Tavily Research is the only connector-backed live research integration.
- The registry removes connector ids other than `tavily-research`.
- `ConnectorMode` is `real`; do not reintroduce fixture or command-launched connector modes unless the user explicitly asks for a contract migration.
- Tavily calls `https://mcp.tavily.com/mcp/` with the Tavily API key and JSON-RPC `tools/call`.
- MiniMax media fixture artifacts are allowed only through `BUBBLES_MINIMAX_MEDIA_FIXTURE` for tests/CI. Do not use fixture media for live demos or product features.

## Tavily Debugging

- Inspect `packages/core/src/connectors/tavilyMcpClient.ts` for session initialization and JSON/SSE parsing.
- Inspect `packages/core/src/connectors/tavilyResearchConnector.ts` for search/extract normalization.
- Inspect `packages/core/src/connectors/tavilySetupService.ts`, `apps/desktop/src/main/ipc/tavilySetupIpc.ts`, and `apps/desktop/src/renderer/screens/SetupScreen.tsx` for setup state.
- Verify only key presence/status. Never print raw Tavily, MiniMax, Gemini, or OpenAI keys.

## External Tool Guidance

- Codex currently has `computer-use` and `lazyweb` MCP servers enabled in the local Codex config.
- Add external MCP servers only when the debugging task needs live private or network data and credentials are available.
- Do not store secrets in repo config, task logs, memory, timeline, or screenshots.
- Use Browser for known local renderer URLs. Use Computer Use for the real Electron window, microphone permission prompts, and menu/window behavior.
