# E2E scenarios (plain English)

Convert entries here into Playwright specs using `.cursor/prompts/gen-e2e.md`.

## SMOKE-001 — App window opens

**Given** the desktop app is built (`pnpm --filter @bubbles/desktop build`).
**When** Electron is launched with `args: ["."]` and `cwd` set to `apps/desktop` (loads `package.json` `"main"`).
**Then** a BrowserWindow appears with title containing "Bubbles" within 30 seconds.

## E2E-002 — First-run wizard appears for new user

**Given** the app is launched with a fresh `userData` directory (no prior onboarding).
**When** the app finishes booting.
**Then** the onboarding wizard is visible with a "Welcome" heading within 10 seconds.

## E2E-003 — Chat message in test mode

**Given** the app is launched in test mode (`BUBBLES_TEST_MODE=1`) with onboarding already complete.
**When** the user types "hi" in the chat input and submits.
**Then** a response containing "Bubbles" appears in the chat within 5 seconds.

## E2E-004 — Agent switcher shows all presets

**Given** the app is launched in test mode with onboarding complete.
**When** the user opens the agent switcher dropdown.
**Then** all 3 agents (Bubbles, Coda, Sage) are visible with their role labels.

## E2E-005 — Quit and relaunch preserves conversation

**Given** the app has an active conversation with at least one message.
**When** the app is closed and relaunched.
**Then** the prior conversation messages are visible in the chat panel on relaunch.
