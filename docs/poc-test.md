# Bubbles POC — Manual Testing Checklist

> Use this checklist to verify the full POC build before declaring Phase 6 complete.
> Run through every section. Check each box only after observing the expected behavior.
> If a check fails, file a bug with the section ID and expected vs actual behavior.

---

## Environment

| # | Check | Command / Step |
|---|-------|----------------|
| E1 | Node ≥ 22 installed | `node -v` |
| E2 | pnpm 10 installed | `pnpm -v` |
| E3 | Dependencies installed | `pnpm install` completes without errors |
| E4 | Native binaries healthy | `pnpm bubbles:doctor` reports all green |
| E5 | TypeScript compiles | `pnpm typecheck` exits 0 |
| E6 | Lint clean | `pnpm lint` exits 0 (warnings OK) |
| E7 | Unit tests pass | `pnpm test` — all 10 suites green |
| E8 | Coverage ≥ 70% | `pnpm test:coverage` — no threshold failures |

---

## Section A: App Launch & Smoke

**Prerequisites:** `pnpm --filter @bubbles/desktop build` completed successfully.

| # | Check | Expected Result |
|---|-------|-----------------|
| A1 | Launch app | `pnpm dev:desktop` — app opens within 5s |
| A2 | Avatar window visible | 256×280 transparent window appears on desktop |
| A3 | Avatar animates | Bubbles idles with blinking animation within 3s |
| A4 | No DevTools in packaged build | `pnpm package:win` → run `.exe` → no DevTools window |
| A5 | System tray icon | Tray icon visible in system tray area |
| A6 | Tray menu works | Right-click tray → Show/Hide, Open Chat, Shortcuts, Quit all functional |

---

## Section B: First-Run Onboarding

**Prerequisites:** Fresh user (delete `~/.bubbles/` or use temp profile).

| # | Check | Expected Result |
|---|-------|-----------------|
| B1 | Wizard appears on first launch | Full-screen onboarding overlay visible with "Welcome to Bubbles" |
| B2 | Step 1 → Next | Click "Get Started" → advances to API key step |
| B3 | Step 2 validates key | Enter valid MiniMax key → "Checking…" → advances to folder step |
| B4 | Step 2 rejects bad key | Enter invalid key → error message shown, stays on step 2 |
| B5 | Step 3 pick folder | Click "Browse" → folder picker dialog opens |
| B6 | Step 3 finish | Click "Finish" → wizard closes, chat panel usable |
| B7 | Onboarding skipped on relaunch | Quit + relaunch → wizard does NOT appear |
| B8 | Test mode bypass | `BUBBLES_TEST_MODE=1 pnpm dev:desktop` → wizard completes with any key |

---

## Section C: Chat & Agent Interaction

**Prerequisites:** Onboarding complete, valid API key set (or `BUBBLES_TEST_MODE=1`).

| # | Check | Expected Result |
|---|-------|-----------------|
| C1 | Open chat via click | Click avatar → chat panel opens anchored to avatar |
| C2 | Open chat via shortcut | Press `Ctrl+Space` → chat panel toggles |
| C3 | Close chat via Escape | Press `Escape` in chat → chat panel hides |
| C4 | Send text message | Type "hi" → Enter → message appears in chat |
| C5 | Receive streaming response | Assistant reply streams in word-by-word |
| C6 | Response within 2s | First token visible within 2 seconds of send |
| C7 | TTS plays | Audio plays after text completes (lip-sync visible) |
| C8 | Lip-sync active | Avatar mouth moves in sync with audio amplitude |
| C9 | Mood transitions | `thinking` → `talking` → `idle` observed during turn |
| C10 | Tool-call chips | When agent uses tool, small pill appears (e.g. `🔧 plan_mode`) |
| C11 | Tool-result chips | Tool result updates pill to `✅ plan_mode` or `❌ plan_mode` |
| C12 | Error toast | On error, toast notification appears (auto-dismisses 4s) |
| C13 | Cost cap blocks | Set cap to $0.01 → send message → "I've hit today's spend cap" |
| C14 | Cost cap allows | Reset cap to $5 → send "hi" → normal response |

---

## Section D: Agent Switching

| # | Check | Expected Result |
|---|-------|-----------------|
| D1 | Open switcher | Click agent name in chat header → dropdown opens |
| D2 | All 3 agents visible | Bubbles, Coda, Sage all shown with role labels and tint dots |
| D3 | Switch to Coda | Click Coda → active agent changes, avatar tint switches to blue |
| D4 | Switch to Sage | Click Sage → active agent changes, avatar tint switches to green |
| D5 | Switch back to Bubbles | Click Bubbles → active agent changes, avatar tint switches to default |
| D6 | Skin persists | Quit + relaunch → last selected agent restored |
| D7 | Coda personality | Ask Coda to write code → response is coding-focused |
| D8 | Sage personality | Ask Sage a research question → response is thoughtful/analytical |
| D9 | Bubbles personality | Ask Bubbles a general question → response is friendly/concise |

---

## Section E: Tools & Permissions

| # | Check | Expected Result |
|---|-------|-----------------|
| E1 | Coda plan_mode | Ask "make todo.md with 3 tasks" → `plan_mode` permission modal appears |
| E2 | Plan rendered nicely | Modal shows steps as numbered list (not raw JSON) |
| E3 | Approve plan | Click "Approve" → `writeFile` permission modal appears |
| E4 | WriteFile diff preview | Modal shows file content preview (new file = "Create new file") |
| E5 | Approve write | Click "Approve" → file created on disk at workspace root |
| E6 | Verify file | `cat ~/.bubbles/workspace/todo.md` (or chosen root) → file exists with content |
| E7 | Deny write | Repeat → click "Deny" → red toast "File write denied", no file created |
| E8 | Auto-allow readFile | Ask "read README.md" → no permission modal, file read directly |
| E9 | Remember choice | Approve + check "Remember" → same tool next time skips modal |
| E10 | Permission audit | `permissions` table in SQLite has rows for all decisions |

---

## Section F: Conversation History

| # | Check | Expected Result |
|---|-------|-----------------|
| F1 | Messages persist | Send messages → quit app → relaunch → messages visible |
| F2 | Last conversation loaded | Chat panel shows prior conversation on relaunch |
| F3 | Tool calls in history | Prior tool calls shown as grey `[tool: ...]` chips |
| F4 | Multi-turn context | Ask follow-up question → agent remembers prior context |
| F5 | Conversation per agent | Switch agent → new conversation starts |
| F6 | Agent conversation isolated | Bubbles conversation not mixed with Coda conversation |

---

## Section G: Settings & Spend Dashboard

| # | Check | Expected Result |
|---|-------|-----------------|
| G1 | Open settings | Click gear icon in chat header → Spend Dashboard modal opens |
| G2 | Today spend visible | Card shows today's spend (should be > 0 if messages sent) |
| G3 | 7-day history visible | Card shows last 7 days aggregate |
| G4 | 30-day history visible | Card shows last 30 days aggregate |
| G5 | Progress bar | Today's spend vs cap shown as progress bar |
| G6 | Change cost cap | Edit cap input → save → new cap enforced on next turn |
| G7 | Cap persists | Quit + relaunch → cap value remembered |

---

## Section H: Avatar Behavior

| # | Check | Expected Result |
|---|-------|-----------------|
| H1 | Drag avatar | Click and drag avatar → window moves with cursor |
| H2 | Click-through transparent | Click transparent area of avatar → click passes to window behind |
| H3 | Avatar follows on move | Drag avatar while chat open → chat panel repositions to follow |
| H4 | Idle animation | Avatar blinks periodically while idle |
| H5 | Thinking animation | While agent processes → `thinking` animation plays |
| H6 | Talking animation | While TTS plays → `talking` animation + lip-sync |
| H7 | Error mood | On agent error → avatar briefly shows `error` mood |
| H8 | Multi-monitor | Move avatar to second monitor → position persists on relaunch |

---

## Section I: Deterministic Test Mode

| # | Check | Expected Result |
|---|-------|-----------------|
| I1 | Test mode chat | `BUBBLES_TEST_MODE=1 pnpm dev:desktop` → send "hi" → canned response |
| I2 | Test mode TTS | TTS plays silent MP3 (no audio but lip-sync fires) |
| I3 | No API key needed | Test mode works without valid MiniMax key |
| I4 | E2E smoke passes | `BUBBLES_TEST_MODE=1 pnpm e2e` → 5/5 specs pass |
| I5 | Eval harness runs | `pnpm eval:ci` → 90 prompts scored, report printed |

---

## Section J: Packaging & Distribution

| # | Check | Expected Result |
|---|-------|-----------------|
| J1 | Build succeeds | `pnpm --filter @bubbles/desktop build` → no errors |
| J2 | Package Windows | `pnpm package:win` → `.exe` produced in `apps/desktop/release/` |
| J3 | Installer < 200 MB | `.exe` file size < 200 MB |
| J4 | Installer runs | Double-click `.exe` → installer opens, completes |
| J5 | Installed app launches | Start menu / desktop shortcut → app opens |
| J6 | First-run on install | Fresh install → onboarding wizard appears |
| J7 | No DevTools in package | Packaged app → no DevTools window |
| J8 | Assets included | Sprites, tray icon, sounds all load correctly |

---

## Section K: CI / Automation

| # | Check | Expected Result |
|---|-------|-----------------|
| K1 | Verify workflow | `pnpm verify:quick` → typecheck + lint + test all green |
| K2 | E2E workflow | `pnpm e2e` → builds desktop + Playwright passes |
| K3 | Eval workflow | `pnpm eval:ci` → deterministic eval completes |
| K4 | Coverage threshold | `pnpm test:coverage` → all packages ≥ 70% |
| K5 | GitHub Actions verify | Push to PR → verify workflow green |
| K6 | GitHub Actions e2e | Push to PR → e2e workflow green (Windows runner) |

---

## Section L: Edge Cases & Recovery

| # | Check | Expected Result |
|---|-------|-----------------|
| L1 | No API key | Launch without key → onboarding forces step 2 |
| L2 | Invalid API key | Enter bad key → validation fails, error shown |
| L3 | Network offline | Live mode + no network → error toast, text still shown |
| L4 | TTS failure | TTS error → text reply delivered, toast "Speech synthesis failed" |
| L5 | Abort mid-turn | Close chat during streaming → turn ends cleanly |
| L6 | Rapid messages | Send multiple messages quickly → queued, processed sequentially |
| L7 | Long message | Paste 1000+ chars → sends, truncates history if needed |
| L8 | Special characters | Send emoji, unicode, code blocks → renders correctly |
| L9 | Empty message | Press Enter with empty input → nothing sent |
| L10 | Very long conversation | 50+ messages → app remains responsive |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Tester | | | ☐ Pass / ☐ Fail |
| Notes | | | |

**Total Checks:** 96  
**Required for Phase 6 Exit Gate:** All Section A–F checks + at least 80% of all checks  
**Blockers:** Any crash, data loss, or security issue is an automatic blocker regardless of score.
