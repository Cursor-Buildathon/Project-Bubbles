# Assistant Workspace UI Notes

Last updated: 2026-05-16

The workspace should present direct MiniMax readiness, Tavily Research setup, voice setup, memory/timeline, Task Drawer, approvals, and agent controls without old fixture connector language.

## Status Surfaces

- Header: MiniMax readiness, live connector count, Tavily MCP.
- Integration bar: MiniMax, Tavily connector health, memory count, voice state.
- Settings rail: MiniMax Token Plan setup, Tavily setup, voice setup, connector controls, memory/timeline.

## Research UX

When research completes, show the full report in chat and use the standard chat-panel voice prompt for the floating bubble. Do not place huge research text into the floating bubble or send it to TTS; long replies should say `Please look in the chat panel for the response.`

## Removed UI Copy

Avoid references to MiniMax CLI, General API keys, MCP fixtures, Gmail, Calendar, Local Files, Google Workspace, or generic Web Search connectors.
