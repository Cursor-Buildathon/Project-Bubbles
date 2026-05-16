# Phase 4 Manual Test Checklist
## Agent Brain & Tools — SkillsCompiler · AgentLoop · PermissionGuard · Built-in Tools

**Pre-requisites**
- Run `pnpm dev:desktop` from the repo root
- MiniMax API key is saved in the chat panel (Settings row visible → enter key → Save Key)
- Avatar window is visible on screen

---

## 4.1 Skills Compiler — Agent Personalities

Verify that each agent compiles its `skills.md` into a distinct identity.

| Step | Action | Expected |
|------|--------|----------|
| 4.1.1 | Open chat panel. Click the agent switcher button (top-right) to cycle agents | Button label changes: Bubbles → Coda → Sage |
| 4.1.2 | With **Bubbles** active, send: `Who are you and what can you do?` | Describes itself as a friendly, read-only file explorer |
| 4.1.3 | Switch to **Coda**, send the same message | Describes itself as a planner that shows a plan before writing anything |
| 4.1.4 | Switch to **Sage**, send the same message | Describes itself as an analytical reader that cites sources |

---

## 4.2 listDir Tool (Auto-approved)

Verify `listDir` runs without a permission modal.

**Setup** — create a test file in the workspace first:

```powershell
New-Item -Force "$env:USERPROFILE\.bubbles\workspace\hello.txt" -Value "Hello from Phase 4!"
```

| Step | Action | Expected |
|------|--------|----------|
| 4.2.1 | Switch to **Bubbles**. Send: `List the files in my workspace` | No permission modal appears |
| 4.2.2 | (continued) | Response contains `hello.txt` |
| 4.2.3 | Avatar mood during the call | Transitions: idle → thinking → idle |

---

## 4.3 readFile Tool (Auto-approved)

Verify `readFile` runs without a permission modal.

| Step | Action | Expected |
|------|--------|----------|
| 4.3.1 | With **Bubbles** active, send: `Read the file hello.txt` | No permission modal appears |
| 4.3.2 | (continued) | Response contains `Hello from Phase 4!` |
| 4.3.3 | Try to read outside workspace: `Read the file C:\Windows\System32\drivers\etc\hosts` | Agent responds with an error — path escapes workspace root |

---

## 4.4 Permission Modal — plan_mode + writeFile (Allow)

Verify the modal appears and the full write flow completes on approval.

| Step | Action | Expected |
|------|--------|----------|
| 4.4.1 | Switch to **Coda**. Send: `Write a file called notes.txt with the content: Phase 4 works!` | Coda calls `plan_mode` first |
| 4.4.2 | Permission modal appears showing tool `plan_mode` and the plan description | Modal is visible, overlays the chat panel |
| 4.4.3 | Click **Allow** | Modal closes; Coda then calls `writeFile` |
| 4.4.4 | A second modal appears for `writeFile` showing path and content | Modal shows the args (path, content) |
| 4.4.5 | Click **Allow** | Modal closes; agent confirms file was written |
| 4.4.6 | Verify in terminal: `Get-Content "$env:USERPROFILE\.bubbles\workspace\notes.txt"` | Outputs: `Phase 4 works!` |

---

## 4.5 Permission Modal — Deny

Verify that denying a tool call stops execution gracefully.

| Step | Action | Expected |
|------|--------|----------|
| 4.5.1 | With **Coda**, send: `Write a file called secret.txt with the content: sensitive data` | plan_mode modal appears |
| 4.5.2 | Click **Deny** | Modal closes |
| 4.5.3 | (continued) | Agent responds that the action was denied — no file is written |
| 4.5.4 | Verify no file created: `Test-Path "$env:USERPROFILE\.bubbles\workspace\secret.txt"` | Outputs `False` |

---

## 4.6 Always Allow Persistence

Verify that "Always Allow" remembers the decision across subsequent calls.

| Step | Action | Expected |
|------|--------|----------|
| 4.6.1 | With **Coda**, send: `Write a file called memo.txt with content: always allow test` | plan_mode modal appears |
| 4.6.2 | Click **Always Allow** | Modal closes; write proceeds normally |
| 4.6.3 | Send: `Write a file called memo2.txt with content: second write` | **No modal for plan_mode** — auto-approved from DB |
| 4.6.4 | (continued) | writeFile modal may still appear (only plan_mode was always-allowed) |
| 4.6.5 | Click **Allow** on writeFile | File is written successfully |

---

## 4.7 plan_mode Approval Auto-approves writeFile in Same Turn

Verify that once `plan_mode` is approved in a turn, the subsequent `writeFile` call in that same turn skips the modal.

| Step | Action | Expected |
|------|--------|----------|
| 4.7.1 | With **Coda**, send: `Create a file todo.md with a two-item task list` | plan_mode modal appears |
| 4.7.2 | Click **Allow** on the plan_mode modal | Modal closes |
| 4.7.3 | (continued) | writeFile executes **immediately** — no second modal in the same turn |
| 4.7.4 | Verify file: `Get-Content "$env:USERPROFILE\.bubbles\workspace\todo.md"` | Contains the task list content |

---

## 4.8 Bubbles Cannot Write (No writeFile Tool)

Verify that Bubbles' tool whitelist prevents file writing.

| Step | Action | Expected |
|------|--------|----------|
| 4.8.1 | Switch to **Bubbles**. Send: `Write a file called test.txt with any content` | No permission modal appears |
| 4.8.2 | (continued) | Agent explains it can only read files, not write — no file is created |
| 4.8.3 | Verify no file: `Test-Path "$env:USERPROFILE\.bubbles\workspace\test.txt"` | Outputs `False` |

---

## 4.9 Sage Cannot Write (No writeFile Tool)

| Step | Action | Expected |
|------|--------|----------|
| 4.9.1 | Switch to **Sage**. Send: `Write something to a file` | No modal; agent declines to write |
| 4.9.2 | Send: `Summarise what is in hello.txt` | No modal; agent reads and summarises the file |

---

## 4.10 Avatar Mood During Tool Calls

| Step | Action | Expected |
|------|--------|----------|
| 4.10.1 | Ask Coda to read and then write a file (multi-step) | Avatar shows **thinking** during LLM streaming |
| 4.10.2 | After the response text completes | Avatar shows **talking** during TTS playback |
| 4.10.3 | After audio finishes | Avatar returns to **idle** |

---

## 4.11 Regression — Plain Chat (No Tools)

Verify Phase 3 chat still works without regressions.

| Step | Action | Expected |
|------|--------|----------|
| 4.11.1 | Switch to **Bubbles**. Send: `What is 2 + 2?` | Streams a text response, no tool calls, no modal |
| 4.11.2 | (continued) | TTS plays the response; avatar mood cycles thinking → talking → idle |
| 4.11.3 | Send a follow-up: `What did I just ask you?` | Replies correctly (conversation context is maintained) |

---

## Exit Gate

All items below must pass before Phase 4 is considered complete.

- [ ] Agent switcher changes personality (Bubbles / Coda / Sage each describe themselves differently)
- [ ] `listDir` and `readFile` run without any permission modal
- [ ] Permission modal appears for `plan_mode` and `writeFile`
- [ ] Clicking **Deny** stops tool execution; agent recovers gracefully; no file is written
- [ ] Clicking **Always Allow** suppresses the modal on all subsequent calls for that tool
- [ ] After `plan_mode` is approved, `writeFile` in the same turn runs without a second modal
- [ ] Bubbles and Sage cannot call `writeFile` (no modal, no file written)
- [ ] Avatar mood transitions correctly during tool-using turns (thinking → talking → idle)
- [ ] Plain conversational chat works end-to-end with no regressions
