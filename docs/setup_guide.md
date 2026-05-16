# Bubbles MVP Setup Guide

## Requirements

- macOS desktop environment.
- Node and pnpm through Corepack.
- MiniMax General API key for direct Bubbles features.
- MiniMax Token Plan Key for CLI authentication.
- Optional connector credentials for email, calendar, local files, and MCP-backed web research.

## Run In Development

```bash
corepack pnpm install
corepack pnpm --filter @bubbles/desktop dev
```

## MiniMax Setup

1. Open the assistant workspace.
2. Enter the MiniMax General API key when prompted.
3. Enter the MiniMax Token Plan Key when prompted.
4. Approve the app-local MiniMax CLI install if requested.
5. Use **Recheck CLI** until the setup status reports ready.

The General API key is never used for CLI auth. The Token Plan Key is never used for direct API verification.

The integrated mock test verified the already-ready path, live CLI task execution, graceful cancellation, and restart recovery. After a successful setup, the chat composer should stay enabled across restart as long as the stored keys and app-local CLI remain valid.

## Connectors

- Web research: configure an MCP/search provider, or use fixture results for demo fallback.
- Email: connect Gmail or Outlook before reading or replying to email.
- Calendar: connect Google Calendar or Outlook Calendar before reading or updating events.
- Local files: approve specific folders before file reads.

Fixture mode is allowed for the buildathon demo, but the workspace labels fixture connectors explicitly.

The mock test verified fixture mode persistence for Web Search, Local Files, Email, and Calendar. Fixture mode is still a demo/development path; do not describe fixture connector output as a real account or live external service.

## Troubleshooting

- MiniMax API unavailable: recheck the General API key and network.
- CLI unavailable: approve install or install `mmx` manually, then use **Recheck CLI**.
- Token Plan auth fails: confirm the key is a Token Plan Key, not the General API key.
- CLI task will not cancel: verify `packages/core/src/cli/cliBridge.ts` still emits `task.cancelled` for early cancellation before the child process is fully registered.
- MCP connector unavailable: keep the demo in fixture mode or configure the provider command.
- Email/calendar auth missing: use fixture mode for the demo or connect the real account.
- Voice unavailable: keep voice off; chat remains the primary demo path.

## Known Limitations

- macOS packaging is configured for unsigned local distribution unless signing credentials are added later.
- Fixture connector data is for demo continuity only and must remain visibly labeled.
- Logs export is intended to be redacted; raw secrets must not be shown in chat, memory, timeline, task drawer, approval previews, or persisted SQLite-backed stores.
- Durable memory and timeline now sanitize token-like strings both when writing new rows and when reopening existing rows.
