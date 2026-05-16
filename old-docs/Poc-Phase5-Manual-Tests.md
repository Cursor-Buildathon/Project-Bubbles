# Phase 5 Manual Test Checklist
## UX, Voice, Permission UI — First-Run Wizard · Chat Anchoring · Agent Switcher · Cost Cap · Diff Preview

**Pre-requisites**
- Run `pnpm dev:desktop` from the repo root
- Delete `~/.bubbles/` and `%APPDATA%/bubbles-store.json` to simulate a first-time user (for onboarding tests)
- Avatar window is visible on screen

---

## 5.1 First-Run Wizard

Verify the 3-step onboarding flow replaces the inline debug API-key panel.

**Setup** — simulate first launch:

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.bubbles" -ErrorAction SilentlyContinue
Remove-Item -Force "$env:APPDATA\bubbles-store.json" -ErrorAction SilentlyContinue
```

| Step | Action | Expected |
|------|--------|----------|
| 5.1.1 | Relaunch `pnpm dev:desktop` | A full-screen **Welcome** wizard overlay appears instead of the chat panel |
| 5.1.2 | Click **Get Started** on Step 1 | Advances to Step 2: API Key input |
| 5.1.3 | Enter a valid MiniMax API key → click **Continue** | Key validates; advances to Step 3: Project Folder |
| 5.1.4 | On Step 3, click **Browse** → pick any folder → click **Finish** | Wizard closes; chat panel becomes usable; toast "Setup complete!" appears |
| 5.1.5 | Type "hello" in chat and send | Streams a reply; no inline API-key form is visible |

---

## 5.2 Conversation History on Relaunch

Verify messages survive app restart.

| Step | Action | Expected |
|------|--------|----------|
| 5.2.1 | Send: `Remember this: my favourite colour is blue` | Assistant acknowledges |
| 5.2.2 | Quit the app (tray → Quit or close windows) | App exits cleanly |
| 5.2.3 | Relaunch `pnpm dev:desktop` | Chat panel opens with prior conversation loaded; the "favourite colour" exchange is visible |
| 5.2.4 | Send: `What is my favourite colour?` | Assistant replies "blue" (context preserved) |

---

## 5.3 Chat Panel Anchoring to Avatar

Verify the chat panel opens next to the avatar, not at a fixed position.

| Step | Action | Expected |
|------|--------|----------|
| 5.3.1 | Drag the avatar to the **bottom-right** of the primary monitor | Avatar stays at the new position |
| 5.3.2 | Click the avatar (or press `Ctrl+Space`) | Chat panel opens to the **left** of the avatar (would go off-screen if placed on the right) |
| 5.3.3 | Drag the avatar to the **top-left** of the screen | Avatar stays at new position |
| 5.3.4 | Click the avatar again | Chat panel opens to the **right** of the avatar |
| 5.3.5 | With chat open, drag the avatar to a new spot | Chat panel repositions to follow the avatar while still visible |

---

## 5.4 Keyboard Shortcuts

| Step | Action | Expected |
|------|--------|----------|
| 5.4.1 | Press `Ctrl+Space` | Chat panel toggles open/closed |
| 5.4.2 | With chat open, press `Escape` | Chat panel closes |
| 5.4.3 | Right-click tray icon → **Keyboard Shortcuts** | A native message box appears listing the shortcuts |

---

## 5.5 Agent Switcher Redesign

Verify the new dropdown card panel replaces the old cycle button.

| Step | Action | Expected |
|------|--------|----------|
| 5.5.1 | In chat header, click the agent name button (e.g. "Bubbles ▼") | A dropdown opens showing 3 cards: Bubbles, Coda, Sage |
| 5.5.2 | Observe each card | Each shows: coloured dot, agent initial avatar, name, role description |
| 5.5.3 | Click **Coda** card | Dropdown closes; header shows "Coda"; avatar tint changes to blue |
| 5.5.4 | Click the agent button again → click **Sage** | Header shows "Sage"; avatar tint changes to green; a new empty conversation starts |
| 5.5.5 | Click back to **Bubbles** | Header shows "Bubbles"; avatar returns to default (white) tint |

---

## 5.6 Daily Cost Cap + Spend Dashboard

Verify spend tracking and cap enforcement.

| Step | Action | Expected |
|------|--------|----------|
| 5.6.1 | Click the **gear icon** (⚙) in the chat header | Spend Dashboard modal opens |
| 5.6.2 | Observe the dashboard | Shows "Today" progress bar, Today / 7 days / 30 days cards |
| 5.6.3 | Set the **Daily cost cap** to `0.01` → click **Save** | Toast "Cost cap updated" appears; progress bar may already show over-cap |
| 5.6.4 | Send any message | Assistant replies with error: *"I've hit today's spend cap. You can raise the limit in Settings."* — no MiniMax API call is made |
| 5.6.5 | Open settings again, set cap back to `5.00` → Save | Cap restored |
| 5.6.6 | Send "hello" | Normal reply streams; Today's spend increments above 0 |

---

## 5.7 Permission Modal Enhancement — plan_mode

Verify `plan_mode` renders as an ordered list instead of raw JSON.

| Step | Action | Expected |
|------|--------|----------|
| 5.7.1 | Switch to **Coda**. Send: `Create a file called plan-test.md with a three-item plan` | Permission modal appears |
| 5.7.2 | Observe the modal content | The plan steps are shown as a **numbered list** (`1.`, `2.`, `3.`) instead of raw JSON |
| 5.7.3 | Click **Allow** | Modal closes; write proceeds |

---

## 5.8 Permission Modal Enhancement — writeFile Diff Preview

Verify file writes show a diff when the file already exists.

| Step | Action | Expected |
|------|--------|----------|
| 5.8.1 | Create a test file: `Set-Content "$env:USERPROFILE\.bubbles\workspace\diff-test.txt" "original content"` | File exists on disk |
| 5.8.2 | With **Coda**, send: `Change diff-test.txt to say: updated content` | Permission modal for `writeFile` appears |
| 5.8.3 | Observe the preview | Left side shows **Current** in red (`original content`); right side shows **New** in green (`updated content`) |
| 5.8.4 | Click **Allow** | File is overwritten |
| 5.8.5 | Send: `Create a file called brand-new.txt with content: hello` | Modal shows **"Create new file"** with content preview (no left side) |

---

## 5.9 Tool-Call Chips in Chat Stream

Verify visual chips appear when the agent calls tools.

| Step | Action | Expected |
|------|--------|----------|
| 5.9.1 | With **Coda**, send: `Make a file called chip-test.txt` | A small grey pill `🔧 plan_mode` appears above the assistant message |
| 5.9.2 | Approve the plan_mode modal | The pill updates to `✅ plan_mode` |
| 5.9.3 | Approve the writeFile modal | A second pill `✅ writeFile` appears |
| 5.9.4 | With **Coda**, send: `Write secret.txt` then deny the modal | A red pill `❌ writeFile` appears; toast "Tool call denied" appears |

---

## 5.10 Error Toasts

| Step | Action | Expected |
|------|--------|----------|
| 5.10.1 | Trigger the cost-cap block (set cap to 0.01, send a message) | A red toast appears in the top-right corner, auto-dismisses after ~4s |
| 5.10.2 | Deny a tool call (see 5.9.4) | A red toast "Tool call denied" appears |
| 5.10.3 | Complete the onboarding wizard | A green toast "Setup complete!" appears |

---

## 5.11 DevTools Gated in Packaged Build

| Step | Action | Expected |
|------|--------|----------|
| 5.11.1 | In dev mode (`pnpm dev:desktop`) | DevTools window opens automatically for the avatar (acceptable for debugging) |
| 5.11.2 | After `pnpm package:win` and running the `.exe` | No DevTools window opens automatically |

---

## 5.12 Tray Menu

| Step | Action | Expected |
|------|--------|----------|
| 5.12.1 | Right-click the system tray icon | Menu shows: Show/Hide Bubbles, Open Chat, **Keyboard Shortcuts**, separator, Quit |
| 5.12.2 | Click **Keyboard Shortcuts** | A native message box lists `Ctrl+Space = Toggle Chat`, `Esc = Close Chat`, drag/click instructions |

---

## 5.13 Regression — Phase 4 Exit Gate

Verify all Phase 4 behaviours still work.

| Step | Action | Expected |
|------|--------|----------|
| 5.13.1 | Switch to **Bubbles**. Send: `Who are you and what can you do?` | Describes itself as a friendly, read-only file explorer |
| 5.13.2 | Send: `List the files in my workspace` | No permission modal; lists files |
| 5.13.3 | Switch to **Coda**. Send: `Write reg-test.txt with content: phase 5 ok` | plan_mode modal → approve → writeFile modal → approve → file on disk |
| 5.13.4 | Switch to **Sage**. Send: `Write something to a file` | No modal; agent declines to write |
| 5.13.5 | Send plain chat to any agent | Mood cycles: idle → thinking → talking → idle |

---

## Exit Gate

All items below must pass before Phase 5 is considered complete.

- [ ] First-run wizard appears on clean install and guides through key + folder setup
- [ ] Chat panel is usable after wizard completes; no inline API-key form remains
- [ ] Quit + relaunch restores the last conversation in the chat panel
- [ ] Chat panel opens anchored to the avatar (right side normally, left side when near right edge)
- [ ] `Ctrl+Space` toggles chat; `Escape` closes chat
- [ ] Agent switcher dropdown shows 3 cards with names, role labels, and tint dots
- [ ] Switching agents changes avatar tint and starts a new conversation
- [ ] Spend Dashboard shows Today/7d/30d totals and a progress bar
- [ ] Cost cap blocks MiniMax calls when exceeded; agent replies with a spend-cap message
- [ ] Permission modal for `plan_mode` shows steps as a numbered list
- [ ] Permission modal for `writeFile` shows a side-by-side diff when file exists
- [ ] Tool-call chips (`🔧`, `✅`, `❌`) appear in the chat stream
- [ ] Error toasts appear for denied tools and cost-cap blocks
- [ ] Tray menu has a **Keyboard Shortcuts** item that shows a native dialog
- [ ] All Phase 4 exit-gate behaviours still pass (no regressions)
