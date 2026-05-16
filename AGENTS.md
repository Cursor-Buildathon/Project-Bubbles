# Bubbles MVP Agent Instructions

This repository is a pnpm workspace for a macOS Electron/Vite desktop app plus a shared TypeScript core package. Use these instructions before debugging, refactoring, or adding features here.

## Stack Map

- Root scripts delegate through `corepack pnpm`.
- `packages/core` contains the app logic: agents, approvals, direct task runners, Tavily research, memory, MiniMax setup/API clients, Gemini/OpenAI STT, MiniMax TTS, orchestration, security, sqlite-backed stores, and timeline.
- `apps/desktop` contains Electron main/preload IPC plus the React renderer, avatar/Pixi stage, UI components, and screen tests.
- The app uses strict TypeScript, Vitest, React Testing Library, jsdom for renderer tests, Electron Vite for desktop builds, `sql.js` for persisted stores, direct MiniMax APIs for AI workflows, and direct voice provider APIs for STT/TTS.
- Bubbles connector support is Tavily-only for live research: the app stores a Tavily API key in Keychain, calls Tavily Remote MCP directly, and uses MiniMax Token Plan APIs to synthesize the cited report.

## Project Skills

Load these project-local skills from `.codex/skills` when their trigger matches:

- `bubbles-debugging`: any bug, failing test, stalled MiniMax task, setup issue, connector issue, IPC issue, or renderer/runtime mismatch.
- `bubbles-refactor`: heavy refactors across core, Electron IPC, renderer state, connector contracts, MiniMax setup, or shared types.
- `bubbles-tooling-mcp`: Tavily Remote MCP setup/debugging, connector IPC, research routing, or external-tool approval flows.

## Debugging Defaults

- Start with the narrowest package command: `npm run test:core`, `npm run test:desktop`, `npm run typecheck:core`, or `npm run typecheck:desktop`.
- Use full checks before claiming completion: `npm test` and `npm run typecheck`.
- For renderer UI work, run `npm run dev`, then verify the relevant local renderer with Browser or the Electron app with Computer Use when a real window is required.
- For connector work, use the Tavily setup service and mocked Tavily MCP clients in tests. Do not reintroduce local MCP fixture commands or Google Workspace connector setup paths.
- Treat task logs, keychain values, MiniMax keys, Tavily keys, and voice provider keys/errors as sensitive. Use existing redaction helpers and never print raw secrets.

## Refactor Guardrails

- Keep service boundaries stable unless the task explicitly includes a contract migration: core services expose typed contracts, Electron main owns IPC and app state hydration, preload exposes the renderer API, and React components consume `window.bubbles`.
- Preserve MiniMax media fixture behavior for CI/demo paths, but do not add MCP connector fixtures. Tavily is the only connector-backed research integration.
- Add or update tests beside the changed behavior. Core service tests should be preferred for business logic; renderer tests should cover UI state and user-visible flows; IPC logic should be tested through small injectable functions where possible.
