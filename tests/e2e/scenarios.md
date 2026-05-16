# E2E scenarios (plain English)

Convert entries here into Playwright specs using `.cursor/prompts/gen-e2e.md`.

## SMOKE-001 — App window opens

**Given** the desktop app is built (`pnpm --filter @bubbles/desktop build`).
**When** Electron is launched with `args: ["."]` and `cwd` set to `apps/desktop` (loads `package.json` `"main"`).
**Then** a BrowserWindow appears with title containing "Bubbles" within 30 seconds.
