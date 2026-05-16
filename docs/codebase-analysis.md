# Codebase Analysis

Last updated: 2026-05-16

Bubbles is a macOS Electron/Vite desktop assistant with a shared TypeScript core package. It uses direct MiniMax HTTPS APIs, Tavily Remote MCP for live research, Gemini/OpenAI STT, MiniMax TTS, SQLite-backed memory/timeline stores, and a human approval system for sensitive local actions.

## Packages

- `packages/core`: agents, approvals, task packets/events, MiniMax clients/runners, Tavily setup/research, voice services, memory, timeline, security, and orchestration.
- `apps/desktop`: Electron main/preload IPC, React renderer, avatar stage, setup/settings UI, chat, Task Drawer, approval UI, and tests.
- `agents`: built-in agent profiles and skills.

## Active Connector Architecture

The connector registry seeds only `tavily-research`.

- Type: `tavily_research`
- Mode: `real`
- Remote URL: `https://mcp.tavily.com/mcp/`
- Tools: `tavily-search`, `tavily-extract`
- Credential: macOS Keychain service `com.bubbles.tavily.api-key`

Old Web Search, Local Files, Email, Calendar, Google Workspace, generic MCP command, and MCP fixture connectors have been removed.

## Research Flow

1. Intent classification maps phrases such as `do me a research` and `search me` to `research.web`.
2. Electron main checks MiniMax and Tavily keys.
3. Tavily Remote MCP returns search results and extracted page content.
4. MiniMax synthesizes a comprehensive cited report.
5. The report is shown in chat, persisted to memory/timeline, and available for follow-up questions.
6. Voice speaks only the ready message unless the user explicitly asks Bubbles to read the report.

## Verification

- Core: `npm run test:core`, `npm run typecheck:core`
- Desktop: `npm run test:desktop`, `npm run typecheck:desktop`
- Full: `npm test`, `npm run typecheck`
