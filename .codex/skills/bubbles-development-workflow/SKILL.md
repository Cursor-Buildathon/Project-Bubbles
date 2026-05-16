---
name: bubbles-development-workflow
description: Use when adding or extending Bubbles MVP product features, workflows, IPC contracts, MiniMax/Tavily/voice capabilities, agents, approvals, memory/timeline behavior, renderer surfaces, or task orchestration. Use for implementation work that is more than a narrow bug fix.
---

# Bubbles Development Workflow

## Start Here

1. Run `npm run audit:capabilities` for broad feature work or when the current wiring is unclear.
2. Classify the requested change by boundary:
   - Renderer/UI: `apps/desktop/src/renderer` and tests beside the component.
   - Electron IPC/runtime: `apps/desktop/src/main`, `preload.ts`, and `global.d.ts`.
   - Business logic/contracts: `packages/core/src`.
   - Agents: `agents/<id>/agent.json` and `skills.md`.
   - External providers: direct MiniMax APIs, Tavily Remote MCP, Gemini/OpenAI STT, or MiniMax TTS.
3. Find all call sites with `rg` before editing exported types, IPC channel names, env flags, or app state shape.

## Current Live Paths

- Chat submits through `app:send-message`, then explicit memory, capability routing, and finally generic MiniMax text tasks.
- Research is Tavily-only: Tavily Remote MCP search/extract plus MiniMax text synthesis.
- Media generation supports direct MiniMax image and music APIs. `BUBBLES_MINIMAX_MEDIA_FIXTURE` is a test/CI helper, not a live feature path.
- Voice input uses Gemini STT with optional OpenAI STT fallback. Voice playback uses MiniMax TTS.
- Approvals, memory, timeline, connectors, and setup status are sqlite/keychain-backed.

## Implementation Rules

- Keep core logic testable outside Electron whenever possible.
- Update `preload.ts`, `global.d.ts`, renderer call sites, and tests together for any IPC/API change.
- Keep secrets out of logs, memory, timeline, task packets, screenshots, and test output.
- Do not reintroduce removed Web Search, Local Files, Gmail, Calendar, Google Workspace, generic command MCP, or MiniMax CLI paths.
- Do not build new live product behavior on fixtures, canned outputs, static demo data, or placeholder artifacts. Use real integrations or surface a clear unavailable state until the real implementation exists.
- If adding a user-visible capability, add a focused test at the lowest responsible boundary and a renderer test when UI state changes.

## Verification

- Narrow core change: `npm run test:core -- <pattern>` then `npm run typecheck:core`.
- Narrow renderer/main change: `npm run test:desktop -- <pattern>` then `npm run typecheck:desktop`.
- Cross-boundary change: `npm test` and `npm run typecheck`.
- Runtime/UI change: run `npm run dev` and verify with Browser or Computer Use when a real Electron window matters.

## Extra Reference

Read `references/architecture-map.md` when you need a compact map of the current wiring.
