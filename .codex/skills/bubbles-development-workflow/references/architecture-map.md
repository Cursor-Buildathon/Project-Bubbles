# Bubbles Architecture Map

## User Message Routing

Renderer `ChatSurface` calls `window.bubbles.sendMessage`.
Electron `app:send-message` handles:

1. Empty input guard.
2. Explicit `remember ...` command.
3. Capability routing through `createFlowRouter`.
4. Generic task fallback through `registerTaskIpc` and `createMiniMaxTaskRunner`.
5. Opportunistic memory extraction after task start.

## Capability Routing

- `research.web`: Tavily Remote MCP search/extract, then MiniMax text report synthesis.
- `creative.image`: direct MiniMax image API, artifact rendered in chat.
- `creative.music`: direct MiniMax music API, artifact rendered in chat.
- `coding.landing_page`: approval-gated local sandbox template generator, accessibility check, Vite build, static local server.
- `agent.create`: direct users to Agent Birth UI.
- `creative.minimax`: generic readiness message unless a specific image/music intent is detected.

## Runtime State

`appState` in `apps/desktop/src/main/main.ts` is the hydration boundary for renderer UI:

- active task and task events
- active/available agents
- approvals
- avatar state
- connectors
- messages with artifacts/citations
- recent memories and timeline events
- voice session state

Any new field should be added to the main state shape, renderer `BubblesAppState`, preload/global typings if exposed, and tests.

## Provider Setup

- MiniMax Token Plan key: setup service and keychain.
- Tavily API key: Tavily setup service and keychain.
- Voice keys: Gemini STT key and optional OpenAI STT fallback key.
- Never log raw keys; use existing redaction helpers.
