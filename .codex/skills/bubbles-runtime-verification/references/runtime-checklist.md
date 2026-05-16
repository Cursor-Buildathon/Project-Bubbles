# Runtime Verification Checklist

## Before Launch

- Confirm the expected env flags. Important flags: `BUBBLES_VOICE_ENABLED`, `BUBBLES_VOICE_APPROVALS_ENABLED`, `BUBBLES_CREATIVE_IMAGE`, `BUBBLES_CREATIVE_MUSIC`, `BUBBLES_CODING_LANDING_PAGE`, `BUBBLES_MINIMAX_MEDIA_FIXTURE`.
- Run `npm run audit:capabilities` if the runtime path is unclear.
- Avoid printing or screenshotting raw provider keys.

## During Launch

- Start `npm run dev`.
- Use Computer Use for the Electron app when window behavior, keychain prompts, microphone permission, or `shell.openExternal/openPath` matters.
- Use Browser only for local renderer/static-site URLs where Electron APIs are not required.

## Evidence To Capture

- Command run and pass/fail.
- Window or browser state observed.
- Any generated artifact path or local URL, without secrets.
- Any failing IPC channel, setup status, or task event type.

## Before Completion

- Stop long-running dev sessions.
- Run the affected typecheck.
- For cross-boundary work, run `npm test` and `npm run typecheck`.
