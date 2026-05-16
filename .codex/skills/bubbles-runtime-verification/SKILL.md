---
name: bubbles-runtime-verification
description: Use when verifying Bubbles MVP behavior after renderer, Electron main/preload, avatar, voice, media artifact, setup, connector, approval, landing-page, or window-management changes. Use when tests are insufficient and a local Browser or real Electron window check is needed.
---

# Bubbles Runtime Verification

## Pick The Surface

- Pure core service: use Vitest and typecheck first; runtime verification is usually unnecessary.
- Renderer-only layout/state: run desktop renderer tests, then use Browser if a local renderer URL is available.
- Electron windows, IPC, Keychain, microphone, shell/system settings, artifact protocol, or local site opening: use Computer Use with `npm run dev`.
- Canvas/avatar rendering: inspect the real window or screenshot; tests may only see fallback DOM.

## Runtime Checklist

1. Start from the narrow failing or changed workflow.
2. Run the focused tests before opening the app when practical.
3. Start `npm run dev` for Electron runtime verification.
4. Verify the visible state, IPC side effects, logs/artifacts, and error state.
5. Stop dev-server sessions before finishing.

## Flow-Specific Checks

- Setup: save/retry/reset MiniMax, Tavily, and voice keys without exposing secrets.
- Voice: microphone permission, push-to-talk, STT error state, TTS playback, barge-in, and voice approval resolution.
- Media: image/audio artifact card renders, `bubbles-artifact://local/...` loads, download works for local artifacts.
- Research: Tavily setup state, connector enabled/healthy state, citations in chat, long report voice summary.
- Landing page: approval appears, generated site opens locally, artifact link works, failed checks are user-visible.
- Window/avatar: panel toggles, dragging moves the right window, avatar state matches task/voice state.

## Verification Commands

- `npm run test:core -- <pattern>`
- `npm run test:desktop -- <pattern>`
- `npm run typecheck:core`
- `npm run typecheck:desktop`
- `npm run dev`

## Extra Reference

Read `references/runtime-checklist.md` before a multi-step manual verification pass.
