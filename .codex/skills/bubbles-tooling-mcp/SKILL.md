---
name: bubbles-tooling-mcp
description: Use when configuring or debugging Bubbles MVP tools, MCP-shaped connectors, fixture connectors, web search, local file access, MiniMax CLI integration, Codex Browser, Computer Use, or Lazyweb.
---

# Bubbles Tooling And MCP

## Available Debug Tools

- `npm test` and `npm run typecheck`: full verification.
- `npm run test:core`, `npm run test:desktop`: package-scoped tests.
- `npm run typecheck:core`, `npm run typecheck:desktop`: package-scoped typechecks.
- `npm run dev`: Electron Vite development runtime.
- Browser plugin: local renderer/browser verification when a local URL is available.
- Computer Use plugin: real Electron window inspection and interaction.
- Lazyweb plugin: UI reference research when improving visual design.

## Bubbles Connector Model

The app does not require every connector to be a live external MCP server during development. It supports:

- `mode: "fixture"` for deterministic demo data.
- `mode: "real"` plus `launchConfig.command`/`args` for MCP-shaped JSON-RPC calls.
- MiniMax search fallback when configured by code.
- Local files through approved roots only.

`createMcpClient` appends one JSON-RPC request as the final command argument. The command should print JSON like:

```json
{"jsonrpc":"2.0","id":1,"result":{"results":[{"title":"Example","url":"https://example.com","snippet":"Text"}]}}
```

## Local Search Fixture

Use this for safe connector debugging without credentials:

```bash
npm run mcp:search-fixture -- '{"jsonrpc":"2.0","id":1,"method":"search","params":{"query":"MCP tools"}}'
```

Configure the Bubbles Web Search connector with:

```json
{
  "command": "node",
  "args": ["tools/mcp/search-fixture.mjs"]
}
```

When the app calls it, `createMcpClient` adds the request argument automatically.

## MCP Guidance

- Codex currently has `computer-use` and `lazyweb` MCP servers enabled in the local Codex config.
- Add external MCP servers only when the debugging task needs live private or network data and credentials are available.
- Keep fixture connectors available even after adding real providers.
- Do not store secrets in repo config, task logs, memory, timeline, or screenshots.
