# Debugging Tooling And MCP Setup

## Repo Commands

- `npm run test:core`: run `packages/core` Vitest tests.
- `npm run test:desktop`: run `apps/desktop` Vitest tests.
- `npm run typecheck:core`: typecheck shared core logic.
- `npm run typecheck:desktop`: typecheck Electron main/preload and renderer.
- `npm test`: run all workspace tests.
- `npm run typecheck`: run all workspace typechecks.
- `npm run dev`: start the Electron Vite app.

## Post Mock-Test Regression Targets

The 14-phase integrated mock test passed after fixes in these areas. Re-run the narrow command first when touching the matching code path:

- CLI task cancellation: `npm run test:core -- cliBridge`
- Durable memory/timeline redaction: `npm run test:core -- memoryStore timelineStore redactSecrets`
- Desktop renderer/main integration: `npm run test:desktop`
- Whole repo confidence check: `npm test` and `npm run typecheck`

The live evidence and phase checklist live in `docs/MVP-Mock-Test-Status.md`. Keep `docs/MVP-Mock-Test.md` as the fixed test contract.

## Codex Tools To Prefer

- Browser: verify local renderer/browser surfaces when a local URL is available.
- Computer Use: inspect and interact with the actual Electron desktop windows.
- Lazyweb: gather UI references before major visual refactors.
- Node REPL: run small JavaScript probes for config, JSON, sqlite fixture inspection, and package metadata.

The current Codex MCP list already includes `computer-use` and `lazyweb`. Add live external MCP servers only when a task specifically needs them and credentials are available.

## Bubbles MCP-Shaped Connector Fixture

The app's `createMcpClient` launches a command and appends a JSON-RPC request as the final argument. For safe local connector debugging, use:

```bash
npm run mcp:search-fixture -- '{"jsonrpc":"2.0","id":1,"method":"search","params":{"query":"Bubbles MCP"}}'
```

Expected output:

```json
{"jsonrpc":"2.0","id":1,"result":{"results":[{"title":"Fixture research for Bubbles MCP","url":"fixture://web-search","snippet":"Local fixture response for connector debugging. Replace with a real MCP provider for live research."}],"provider":"fixture"}}
```

To wire it into the Web Search connector during development:

```json
{
  "enabled": true,
  "mode": "real",
  "authStatus": "ready",
  "healthStatus": "healthy",
  "launchConfig": {
    "command": "node",
    "args": ["tools/mcp/search-fixture.mjs"]
  }
}
```

Use `mode: "fixture"` for demo fallback when the app should not launch any external command.

## Debugging Boundaries

- Renderer symptom: start in `apps/desktop/src/renderer`, then check `preload.ts` if `window.bubbles` behavior is involved.
- IPC or app state symptom: inspect `apps/desktop/src/main/main.ts` and `apps/desktop/src/main/ipc`.
- Service behavior: inspect `packages/core/src` and its colocated tests.
- Connector behavior: inspect registry state, mode, auth status, launch config, fixture fallback, and `packages/core/src/connectors`.
- MiniMax setup or task execution: inspect setup service, CLI manager, task IPC, CLI bridge, and task logs.
- Cancellation bug: inspect `packages/core/src/cli/cliBridge.ts` first. The bridge must remember known task ids, tolerate a cancel request before child-process registration, emit `task.cancelled`, and clear active state on settle.
- Redaction bug: inspect `packages/core/src/security/redactSecrets.ts`, memory/timeline stores, and explicit memory handling in `apps/desktop/src/main/main.ts`. Token-like content should be redacted before logs, persisted memory, persisted timeline, previews, and chat echoes that summarize secret-bearing memory.
- Agent Birth JSON bug: inspect MiniMax JSON extraction and `packages/core/src/agents/agentBirthService.ts`. Generated drafts should be normalized before preview and approval so wrapped or partially shaped model JSON does not break the flow.
