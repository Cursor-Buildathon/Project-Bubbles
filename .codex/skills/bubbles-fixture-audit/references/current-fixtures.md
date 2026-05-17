# Current Fixture-Like Baseline

## Accepted Fallbacks

- `BUBBLES_MINIMAX_MEDIA_FIXTURE` can make direct image/music requests write deterministic SVG/WAV artifacts for tests/CI only.
- Do not use this flag for live product features or demos.
- Renderer-only no-preload fallback echoes `I heard: ...` for browser development outside Electron.

## User-Reachable Static Or Partial Surfaces

- Landing-page generation is approval-gated and executable, but the generated page is a fixed template.
- Conversation history is hard-coded and has no conversation persistence.
- Avatar drop target has visual feedback but no file ingestion behavior.
- QA seed agent contains placeholder skills and non-wired tool labels.

## Declared Contracts To Check

- `TaskEvent` includes tool/approval event types that may not have emitters.
- Agent `allowedTools` are passed in task packets but generic task execution does not run tools.
- `voiceTypes.ts` has future-facing capability interfaces that may be unused.
