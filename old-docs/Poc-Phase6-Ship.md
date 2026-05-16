# Phase 6 — Test, Harden, Ship

## Overview

Phase 6 is the final hardening and shipping milestone for the Bubbles POC. It adds deterministic testing, E2E coverage, agent evaluation, visual regression baselines, packaging, and comprehensive documentation.

## What's New in Phase 6

### 1. Deterministic Test Mode (`BUBBLES_TEST_MODE=1`)

- **MiniMax chat** returns predictable canned responses instead of calling the live API
- **TTS** returns a silent MP3 frame (valid MP3 header, no audio data)
- Activated via environment variable — no code changes needed in consuming packages
- Enables CI-friendly E2E and eval runs without API keys or network access

```bash
BUBBLES_TEST_MODE=1 pnpm dev:desktop    # Run app in test mode
BUBBLES_TEST_MODE=1 pnpm e2e            # Run E2E tests deterministically
```

### 2. E2E Suite (5 scenarios)

| Spec | Scenario |
|------|----------|
| `smoke.spec.ts` | App window opens with "Bubbles" title |
| `onboarding.spec.ts` | First-run wizard appears and can be completed |
| `chat.spec.ts` | Send message, receive test-mode response |
| `agent-switcher.spec.ts` | All 3 preset agents visible in dropdown |
| `history.spec.ts` | Conversation persists across app relaunch |

All specs use reusable fixtures (`tests/e2e/fixtures.ts`) with:
- Temp `userData` directory per test (auto-cleaned)
- `BUBBLES_TEST_MODE=1` env var
- Helper utilities for onboarding, chat, window lookup

### 3. Agent Eval Harness (90 prompts)

- **Dataset**: 30 prompts × 3 agents (Bubbles, Coda, Sage) in `tests/agent-eval/dataset.jsonl`
- **Scoring**: Deterministic rubric-based scoring by default; optional `--live` flag for LLM-as-judge
- **Threshold**: Average ≥ 4.0/5 required to pass
- **CLI**: `pnpm eval` (deterministic), `pnpm eval:ci` (CI mode)

```bash
pnpm eval              # Run eval with default deterministic scorer
pnpm eval --live       # (Future) Run with live LLM-as-judge
```

### 4. Visual Regression (4 moods × 3 agents)

- Matrix: 12 snapshot tests in `tests/visual/visual.spec.ts`
- Config: `playwright.visual.config.ts` with `maxDiffPixels: 50`
- Baselines stored in `tests/visual/snapshots/`

```bash
npx playwright test --config=playwright.visual.config.ts --update-snapshots
```

### 5. Hardening

| Area | Change |
|------|--------|
| Network retries | `backoff.ts` now retries on transient errors (fetch failures, timeouts, ECONNRESET) |
| TTS fallback | On TTS failure, app emits a toast + keeps text reply |
| Error toasts | Agent errors surface as structured toasts, not just appended stream text |
| SQLite | Added `busy_timeout = 5000` for graceful concurrent access |

### 6. Packaging & CI

- `pnpm package:win` at root → builds NSIS installer
- Dormant signing hooks via `CSC_LINK` / `CSC_KEY_PASSWORD` env vars
- Dormant auto-update scaffold (`BUBBLES_ENABLE_AUTO_UPDATE=1` to activate)
- Release workflow checks installer size < 200 MB
- E2E workflow runs with `BUBBLES_TEST_MODE=1`
- Verify workflow runs deterministic eval

### 7. Coverage Thresholds

All packages enforce **70% minimum** coverage:
- lines, functions, branches, statements

## Verification Commands

```bash
# Full verification pipeline
pnpm verify:quick          # typecheck + lint + test (no e2e)
pnpm verify                # full pipeline including e2e

# Individual areas
pnpm test:coverage         # unit tests with coverage
pnpm e2e                   # Playwright E2E (builds desktop first)
pnpm eval:ci               # deterministic agent eval
pnpm package:win           # Windows NSIS installer

# Health check
pnpm bubbles:doctor        # environment + native binary check
```

## Phase 6 Exit Gate

A stranger can:
1. Install Windows installer (< 200 MB)
2. Enter MiniMax API key in first-run wizard
3. See Bubbles appear
4. Type "hi" → spoken, lip-synced reply within 2s of first token
5. Switch to Coda → ask "make hello.txt with my name" → approve preview → file on disk
6. Switch to Sage → thoughtful reply in Sage's voice
7. Quit, relaunch, see prior conversation

**CI Verification**: `pnpm verify` green ≥ 70% coverage • `pnpm e2e` 5/5 pass • `pnpm eval:ci` ≥ 4.0/5 • `pnpm package:win` produces `.exe`
