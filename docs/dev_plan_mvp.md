# Development Plan MVP

Last updated: 2026-05-16

## Active Milestones

- Keep MiniMax Token Plan setup stable.
- Keep direct MiniMax task, TTS, image, and music APIs covered by tests.
- Keep voice input single-turn and wake-phrase behavior stable.
- Keep spoken output concise: replies under 50 normalized characters are read aloud, and longer replies point to the chat panel.
- Ship Tavily-only research with comprehensive chat output and chat-panel voice prompting for long reports.
- Preserve follow-up conversation over the latest research report.

## Verification

- `npm run test:core`
- `npm run test:desktop`
- `npm run typecheck:core`
- `npm run typecheck:desktop`
- `npm test`
- `npm run typecheck`

## Removed Milestones

Do not plan new work around MiniMax CLI, General API keys, MCP fixtures, Gmail, Calendar, Local Files, Google Workspace OAuth, or generic MCP command launchers.
