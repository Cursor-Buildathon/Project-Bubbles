# Bubbles MVP Agent Instructions

This repository is a pnpm workspace for a macOS Electron/Vite desktop app plus a shared TypeScript core package. Use these instructions before debugging, refactoring, or adding features here.

## Stack Map

- Root scripts delegate through `corepack pnpm`.
- `packages/core` contains the app logic: agents, approvals, CLI bridge, connectors, memory, MiniMax setup, orchestration, security, sqlite-backed stores, and timeline.
- `apps/desktop` contains Electron main/preload IPC plus the React renderer, avatar/Pixi stage, UI components, and screen tests.
- The app uses strict TypeScript, Vitest, React Testing Library, jsdom for renderer tests, Electron Vite for desktop builds, `sql.js` for persisted stores, and `mmx`/MiniMax for AI workflows.
- Bubbles connector support is hybrid: fixture mode, local file roots, MiniMax fallback, and MCP-shaped JSON-RPC launch commands are all valid depending on the connector.

## Project Skills

Load these project-local skills from `.codex/skills` when their trigger matches:

- `bubbles-debugging`: any bug, failing test, stalled CLI task, setup issue, connector issue, IPC issue, or renderer/runtime mismatch.
- `bubbles-refactor`: heavy refactors across core, Electron IPC, renderer state, connector contracts, MiniMax setup, or shared types.
- `bubbles-tooling-mcp`: tool setup, MCP connector work, fixture connector work, local search connector debugging, or external-tool approval flows.

## Debugging Defaults

- Start with the narrowest package command: `npm run test:core`, `npm run test:desktop`, `npm run typecheck:core`, or `npm run typecheck:desktop`.
- Use full checks before claiming completion: `npm test` and `npm run typecheck`.
- For renderer UI work, run `npm run dev`, then verify the relevant local renderer with Browser or the Electron app with Computer Use when a real window is required.
- For connector work, prefer fixture mode first. Use `npm run mcp:search-fixture -- '<json-rpc-request>'` to exercise the local MCP-shaped command path without network or credentials.
- Treat task logs, keychain values, connector env, and MiniMax keys as sensitive. Use existing redaction helpers and never print raw secrets.

## Refactor Guardrails

- Keep service boundaries stable unless the task explicitly includes a contract migration: core services expose typed contracts, Electron main owns IPC and app state hydration, preload exposes the renderer API, and React components consume `window.bubbles`.
- Preserve fixture behavior while adding real integrations; demo fallback is an intentional product path.
- Add or update tests beside the changed behavior. Core service tests should be preferred for business logic; renderer tests should cover UI state and user-visible flows; IPC logic should be tested through small injectable functions where possible.
