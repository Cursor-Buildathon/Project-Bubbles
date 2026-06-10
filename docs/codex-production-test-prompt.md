# Bubbles Production Test — Codex Agent Prompt

> **Target agent:** GPT 5.5 in Codex with full Computer Use + Browser access
> **Generated:** 2026-05-17

---

## System Role

You are a senior QA engineer testing a macOS Electron desktop application called **Bubbles**. You have full computer and browser access. You will execute a phased production test plan against the live running application, capture evidence, and produce a structured test report.

**Your capabilities:**
- You can see the screen, click UI elements, type text, press keyboard shortcuts, and interact with the Electron app window.
- You can open and interact with browser windows.
- You can run terminal commands.
- You can take screenshots as evidence at every test step.
- You can read and write files on the filesystem.

**Critical rules:**
1. **NEVER copy, screenshot, or log raw API keys, tokens, or secrets.** If you see one, redact it as `[REDACTED]` in your report.
2. **Execute every test step sequentially within each phase.** Do not skip steps.
3. **Take a screenshot after every test ID** as evidence. Name screenshots `<TEST-ID>.png` (e.g., `SHELL-01.png`).
4. **Wait for async operations to complete** (image/music/video generation, research, landing-page builds) before evaluating results. Use visual cues like spinners stopping, status text changing, or avatar state returning to idle.
5. **Record PASS or FAIL for every test ID.** On FAIL, fill out a failure entry using the template in the final report.
6. **Do not fabricate results.** If something is unclear or partially working, mark it as FAIL with notes explaining what you observed.
7. **Restore all flags and keys to their original state** after any negative/degraded test.

---

## Phase 0 — Environment Setup & Precondition Verification

**Goal:** Confirm the test environment is valid before any functional testing.

### Step 0.1 — Run Pre-flight Commands

Open a terminal in the project root `/Users/dev/Documents/GitHub/Project-Bubbles` and run each command, waiting for completion:

```bash
npm run audit:capabilities
```
```bash
npm run audit:fixtures
```
```bash
npm run typecheck
```
```bash
npm test
```

**Record:**
- Whether each command passes or fails.
- Capture any failure output (redacted) for the report.
- If tests fail, note the failure count and affected suites but continue the test plan.

### Step 0.2 — Verify Environment Variables

Confirm these preconditions by checking the environment (do NOT print key values, only confirm set/unset):

- `BUBBLES_MINIMAX_MEDIA_FIXTURE` is unset or `false`
- `BUBBLES_CREATIVE_IMAGE` is NOT `false`
- `BUBBLES_CREATIVE_MUSIC` is NOT `false`
- `BUBBLES_CREATIVE_VIDEO` is NOT `false`
- `BUBBLES_CODING_LANDING_PAGE` is NOT `false`
- `BUBBLES_VOICE_ENABLED` is NOT `false`
- `BUBBLES_VOICE_APPROVALS_ENABLED` is NOT `false`

### Step 0.3 — Launch the Application

```bash
cd /Users/dev/Documents/GitHub/Project-Bubbles && npm run dev
```

Wait for the Electron app to appear. Take a screenshot once the floating Bubbles avatar is visible.

### Step 0.4 — Fill Test Metadata

Record in your report:
- Date: today's date
- Build/branch/commit: run `git rev-parse --short HEAD` and `git branch --show-current`
- macOS version: run `sw_vers`
- Environment: Local dev

---

## Phase 1 — Launch & Shell Smoke Test

**Goal:** Confirm the app shell is healthy before workflow testing.

Execute each test in order. Take a screenshot after each.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| SHELL-01 | Observe the launched app. | Floating Bubbles avatar is visible. No crash dialog. |
| SHELL-02 | Click the floating avatar to open the workspace. | Assistant panel opens showing chat, setup, connectors, task drawer, approvals, memory, and agent rail. |
| SHELL-03 | Close the panel using the close control, then reopen via avatar. | Panel closes and reopens without losing visible state. |
| SHELL-04 | Drag the window header/avatar area to move the window. | Window moves smoothly and remains interactive. |
| SHELL-05 | Inspect the Readiness area in the panel. | MiniMax readiness and Tavily connector status are visible. |
| SHELL-06 | Click `Export redacted logs`. | Export completes. Inspect the exported file to confirm no raw keys or tokens are present. |

**Evidence:** Screenshot of healthy workspace, app version.

**If any SHELL test fails:** Record the failure but continue to Phase 2. Shell failures are blockers for the final exit criteria.

---

## Phase 2 — Setup & Connector Workflow

**Goal:** Verify MiniMax, Tavily, and voice providers are configured and healthy.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| SETUP-01 | In Settings, verify MiniMax setup status. If not ready, save a Token Plan key through the UI and click `Recheck MiniMax`. | Status shows `MiniMax API is ready.` and chat composer is enabled. |
| SETUP-02 | Save Tavily API key if needed. Click `Recheck Tavily`. | Tavily status says Remote MCP is ready. Connector shows ready/healthy. |
| SETUP-03 | In Connectors, click `Check Tavily Research`. | Connector remains enabled with ready/healthy status. |
| SETUP-04 | Disconnect Tavily, confirm degraded status, then re-enable and recheck. | Research unavailable while disconnected; returns to healthy after re-enable. |
| SETUP-05 | Save Gemini STT key (and optional OpenAI fallback key) in voice setup. | Voice setup reports voice ready or a clear reason why not. |
| SETUP-06 | If testing reset flows: use reset controls, then re-save keys. | Reset is visible; re-saving restores readiness. |

**Evidence:** Screenshots of MiniMax ready, Tavily ready, voice ready. Do NOT capture raw key values.

---

## Phase 3 — Introduce Itself Workflow

**Goal:** Verify the simple router path and TTS handoff.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| INTRO-01 | Type and send: `Introduce yourself` | Bubbles replies listing its capabilities: planning, memory, Tavily research, image/music/video creation, landing pages, agents, approvals, voice. |
| INTRO-02 | Observe the avatar during and after the response. | Avatar reaches a positive/celebrating state; does not remain stuck in working/listening. |
| INTRO-03 | If voice is enabled, wait for speech playback. | Bubbles speaks the introduction once and returns to voice ready/idle. |
| INTRO-04 | Send: `Bubbles, introduce yourself.` | Same capability response works again without duplicate stuck speech. |

**Failure checks:**
- If MiniMax is not ready, chat should be disabled with setup guidance.
- If voice is off, text response should still succeed.

---

## Phase 4 — Web Search Workflow

**Goal:** Verify Tavily live research, MiniMax synthesis, citations, memory, follow-up, and read-aloud.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| SEARCH-01 | Send: `Search for the latest MiniMax Token Plan API capabilities and summarize the practical setup steps with sources.` | Chat records the prompt. Bubbles starts a research task (not canned/fixture output). |
| SEARCH-02 | Wait for completion. | Structured research report with source citations appears. |
| SEARCH-03 | Inspect citations under the assistant message. | Each citation has title/link/snippet. Links open externally in the browser. |
| SEARCH-04 | Open Task Drawer and Memory/Timeline. | Task completion and research summary visible. No stuck active task. |
| SEARCH-05 | Send: `What are the most important setup risks from that report?` | Bubbles answers from the prior report and keeps citations. |
| SEARCH-06 | Send: `Read the research output aloud.` | Bubbles reuses the latest research. If voice is ready, it speaks. Text remains available. |
| SEARCH-07 | Temporarily disconnect Tavily and send a new search prompt. | Bubbles returns clear setup/connector guidance, not a fake report. **Re-enable Tavily afterward.** |

**Pass criteria to verify:**
- Report content is current for the topic.
- Sources are real Tavily results (not fixture).
- No raw Tavily key, MiniMax key, stack trace, or unredacted payload shown.
- Follow-up uses previous research context.
- Voice read-aloud does not alter report content.

---

## Phase 5 — Image Generation Workflow

**Goal:** Verify live MiniMax image generation, artifact rendering, download, and TTS.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| IMAGE-01 | Send: `Generate an image of a polished glass greenhouse on Mars at sunrise, cinematic but realistic.` | Chat shows image generation in progress. Task Drawer shows received/running. |
| IMAGE-02 | Wait for completion. | Bubbles says the image is ready. Avatar returns to positive state. |
| IMAGE-03 | Inspect the image artifact card. | Image preview renders from a local artifact URL/path. NOT an SVG fixture. |
| IMAGE-04 | Click `Download` on the image card. | Status changes to `Saved to Downloads.` File appears in Downloads folder. Verify with `ls ~/Downloads`. |
| IMAGE-05 | If voice is ready, listen for TTS. | Short completion line spoken once, then idle. |

**Pass criteria:**
- Generated file opens outside the app (verify by opening it from Downloads).
- No secrets exposed in artifact title/path.
- Failed provider responses are redacted and user-readable.

---

## Phase 6 — Music Generation Workflow

**Goal:** Verify live MiniMax music generation, audio playback, artifact download.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| MUSIC-01 | Send: `Create a short music track for a calm product launch video, modern, warm, and optimistic.` | Chat shows music generation in progress. Task Drawer shows received/running. |
| MUSIC-02 | Wait for completion. | Bubbles says the music is ready. No stuck active task. |
| MUSIC-03 | Inspect the audio artifact card. | Audio control appears. |
| MUSIC-04 | Press play in the audio control. | Audio plays without crash or broken source errors. |
| MUSIC-05 | Click `Download` on the audio card. | `Saved to Downloads.` appears. Verify file in Downloads. |
| MUSIC-06 | If voice is ready, listen for TTS. | Short completion line spoken once, then idle. |

**Pass criteria:**
- Audio is a real provider artifact, not a fixture WAV.
- Playback controls remain usable after download.
- Errors are shown in chat and do not leave avatar/task stuck.

---

## Phase 7 — Video Generation Workflow

**Goal:** Verify live MiniMax video generation. This may take several minutes.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| VIDEO-01 | Send: `Generate a short video of ocean waves rolling over black sand at golden hour.` | Chat shows video generation in progress. Task Drawer shows received/running. |
| VIDEO-02 | Wait during processing (may take minutes). | UI remains responsive. Task does not duplicate or disappear. |
| VIDEO-03 | Wait for completion. | Bubbles says the video is ready. |
| VIDEO-04 | Inspect the video artifact card. | Video control appears with local artifact source. |
| VIDEO-05 | Press play. | Video plays without broken source errors. |
| VIDEO-06 | Click `Download`. | `Saved to Downloads.` Verify file. |

**Pass criteria:**
- Video is a real provider artifact, not fixture bytes.
- Long-running state is understandable.
- Provider failure is redacted and does not crash the renderer.

---

## Phase 8 — Landing Page Creation Workflow

**Goal:** Verify approval-gated landing-page generation, sandbox, browser preview, revision.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| LANDING-01 | Send: `Build a landing page for Aurora Habit, a focused habit tracker for busy founders.` | Approval request created. Bubbles says approval is needed. |
| LANDING-02 | Inspect the approval panel/modal. | Title is `Generate landing page`, risk visible, preview includes sandbox workflow. |
| LANDING-03 | Click `Approve`. | Bubbles says it is generating the landing page. Avatar/task state → working. |
| LANDING-04 | Wait for generation, accessibility check, and build. | No raw command output/secrets shown. If checks fail, redacted explanation appears. |
| LANDING-05 | After success, observe the browser. | Generated page opens at `http://127.0.0.1:<port>`. |
| LANDING-06 | Inspect the page: first viewport, responsive behavior, copy, images, buttons, layout. | Page is polished, usable, no obvious overlap/clipping. |
| LANDING-07 | Confirm project saved under `~/Downloads/Bubbles Landing Pages`. | Folder exists with metadata and built output. Verify with `ls`. |
| LANDING-08 | Inspect chat artifact card. | Site artifact shows title/local URL and opens the generated site. |
| LANDING-09 | Send: `Make the hero copy shorter and add a pricing section.` | Revision approval request created. |
| LANDING-10 | Approve the revision. | Regeneration, checks/build, updated project saved, local preview reopens. |
| LANDING-11 | Inspect the reopened page. | Requested changes visible. Old preview not confused with new one. |

**Pass criteria:**
- File-writing and command-running only happen after approval.
- Generated site stays inside managed landing-page directory.
- No remote scripts/fonts introduced.
- Accessibility/build failures visible and redacted.

**Deny path (run separately after main flow):**
- Create another landing-page request. Click `Deny`. Confirm landing page is NOT generated and denied outcome is clear.

---

## Phase 9 — Agent Birth System Workflow

**Goal:** Verify chat-triggered agent creation, draft approval, file creation, switch prompt.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| AGENT-01 | Send: `Create a research analyst agent for competitive product research.` | Chat says Bubbles is drafting agent files. Task Drawer shows `task.received` / `task.status` for `agent.create`. |
| AGENT-02 | Wait for draft completion. | Approval appears with title like `Create <Agent Name>`, action type = agent file creation. |
| AGENT-03 | Inspect approval preview. | Preview includes profile, agent markdown, skills markdown. No visual/avatar customization instructions. |
| AGENT-04 | Click `Approve`. | Agent files created. Task Drawer shows result/completion. |
| AGENT-05 | Observe chat after approval. | Bubbles asks: `Agent Created, Should I switch to new agent`. |
| AGENT-06 | Reply: `yes, switch to the new agent` | New agent becomes active. Agent rail/header updates. Timeline records activation. |
| AGENT-07 | Send a simple task to the new agent (e.g., `What can you help me with?`). | Chat routes through the active agent without errors. |

**Pass criteria:**
- No files written before approval.
- Agent profile has safe allowed tools/memory/safety rules.
- Agent rail lists the created agent.

**Deny path (run separately):**
- Create another agent. Click `Deny`. Confirm no agent is created and denied outcome is clear.

---

## Phase 10 — General Chat & Memory Workflow

**Goal:** Verify baseline MiniMax text behavior, memory save/recall/clear.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| CHAT-01 | Send: `Help me plan a three-step launch checklist for a small desktop app.` | Useful plan returned without triggering research/media/landing/agent flows. |
| CHAT-02 | Try submitting blank input or whitespace only. | Nothing sent; no empty user message appears. |
| CHAT-03 | Inspect Memory/Timeline after chat task. | Task started/completed event appears. |
| MEMORY-01 | Send: `Remember that I prefer concise launch plans with risks listed first.` | Bubbles replies `I'll remember: ...`. Memory panel shows saved preference. |
| MEMORY-02 | Send: `Plan my next release checklist.` | Response reflects the saved preference. |
| MEMORY-03 | Send: `For future research, I prefer source links grouped by vendor.` | If automatic extraction runs, Memory panel updates. |
| MEMORY-04 | Inspect Timeline. | Memory created event appears with readable summary. |
| MEMORY-05 | Click `Clear memory`. | Memories clear from panel. Subsequent responses do not rely on cleared data. |

**Pass criteria:**
- Prompt is not misclassified into another workflow.
- Explicit memory is deterministic.
- Memory content is redacted (no secrets).
- Clear action updates UI without restart.

---

## Phase 11 — Voice Input, TTS & Barge-In Workflow

**Goal:** Verify live microphone capture, STT, spoken responses, and interruption.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| VOICE-01 | Confirm voice status says `Voice ready`. | Voice button is enabled. |
| VOICE-02 | Click the microphone button or press `Cmd+Shift+Space`. | Status changes to Listening. Captions/partial text appear if available. |
| VOICE-03 | Say clearly: "Introduce yourself", then stop listening. | Transcript submitted to chat, Bubbles responds via intro workflow. |
| VOICE-04 | Wait for spoken response. | Status → Speaking, audio plays, then returns to Voice ready. |
| VOICE-05 | While Bubbles is speaking, start another voice input to barge-in. | Current speech stops cleanly. Voice/session state remains usable. |
| VOICE-06 | If Gemini quota unavailable and OpenAI fallback configured, repeat voice input. | Fallback transcribes or reports clear failure. |

**Pass criteria:**
- Microphone permission flow is clear.
- Captions do not overlap core UI.
- Voice errors do not crash the app.
- TTS never repeats indefinitely.

---

## Phase 12 — Voice Approval Workflow

**Goal:** Verify pending approvals can be resolved by speech.

**Setup:** Start a landing-page or agent-birth workflow and wait until an approval is pending.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| VAPP-01 | With approval pending, start voice and say: "approve it" | Pending approval is approved; workflow continues. |
| VAPP-02 | On a NEW pending approval, say: "deny it" | Approval denied; no sensitive action runs. |
| VAPP-03 | On a NEW pending approval, say: "cancel that" | Approval cancelled; action does not run. |
| VAPP-04 | Say: "maybe later" against a pending approval. | Bubbles asks for clearer input or directs to buttons. |

**Pass criteria:**
- Approval status changes exactly once.
- Workflow continuation matches the decision.
- Ambiguous speech never executes the action.

---

## Phase 13 — Approval Button Workflow

**Goal:** Verify click-based approvals independent of voice.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| APPROVAL-01 | Create a landing-page or agent approval and click `Approve`. | Approved; workflow continues. |
| APPROVAL-02 | Create a fresh approval and click `Deny`. | Denied; workflow does not continue. |
| APPROVAL-03 | Create a fresh approval and click cancel/close. | Cancelled; workflow does not continue. |
| APPROVAL-04 | Click approve/deny rapidly. | Only one decision accepted. No duplicate work. |
| APPROVAL-05 | Restart app while an approval is pending (if feasible). | Pending approval is still visible or safe state is restored. |

**Pass criteria:**
- Sensitive workflows never bypass approval.
- Denied/cancelled actions are not executed.

---

## Phase 14 — Artifact Handling Workflow

**Goal:** Verify all artifact types render, open, download, and remain sandboxed.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| ART-01 | Use the completed image from Phase 5. | Image preview loads and download works. |
| ART-02 | Use the completed audio from Phase 6. | Audio control loads, plays, download works. |
| ART-03 | Use the completed video from Phase 7. | Video control loads, plays, download works. |
| ART-04 | Use the completed landing page from Phase 8. | Site artifact opens local URL. |
| ART-05 | Attempt to interact only through visible artifact controls. | No arbitrary filesystem paths exposed. |
| ART-06 | Inspect downloaded file names. | Names are readable, no unsafe characters. |

---

## Phase 15 — Task Drawer & Cancellation Workflow

**Goal:** Verify visible task lifecycle and cancellation.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| TASK-01 | Review Task Drawer from media generation phases. | Shows received/running/result or error events. |
| TASK-02 | Review Task Drawer from agent birth phase. | Shows received/status/approval required/result events. |
| TASK-03 | Review Task Drawer from landing page phase. | Working state visible during generation/check/build. |
| TASK-04 | If a cancel button is available during a long-running task, click it. | Task cancellation reflected in UI, or clear unsupported message. |
| TASK-05 | After all workflows finish. | Active task clears. Avatar not stuck in working/waiting. |

---

## Phase 16 — Agent Switching Workflow

**Goal:** Verify switching among existing agents.

| Test ID | Action | Expected Result |
|---------|--------|-----------------|
| SWITCH-01 | Inspect Agent rail. | General assistant and any created agents appear. |
| SWITCH-02 | Click a non-active agent. | Header/rail updates. Timeline records activation. |
| SWITCH-03 | Send a normal prompt. | Chat usable; active agent stays selected. |
| SWITCH-04 | Restart the app. | Previously created agents persist. |

---

## Phase 17 — Negative & Degraded State Matrix

**Goal:** Verify graceful degradation. **Restore all keys and flags after each test.**

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| NEG-01 | Missing MiniMax key | Reset Token Plan key, attempt chat. | Chat disables or returns clear setup guidance. **Restore key.** |
| NEG-02 | Invalid MiniMax key | Save an invalid key. | Redacted, user-readable error. **Restore valid key.** |
| NEG-03 | Missing Tavily key | Reset Tavily key, send search prompt. | "Tavily Research is not connected" or equivalent. **Restore key.** |
| NEG-04 | Network unavailable | Disconnect network, retry research/media. | Clear provider/network failure; app usable. **Reconnect.** |
| NEG-05 | Missing microphone | Revoke mic permission, start voice. | Explains mic issue; no crash. **Restore permission.** |
| NEG-06 | Provider timeout | Use a long-running request and observe. | UI responsive; errors redacted if timeout occurs. |
| NEG-07 | Misclassification guard | Send `research bakeries` after a landing page is active. | Routes to research, NOT landing-page revision. |
| NEG-08 | Fixture guard | Inspect all generated media from this test run. | None are fixture SVG/WAV/video bytes. |

---

## Phase 18 — End-to-End Demo Script (Validation Run)

**Goal:** Execute the full demo sequence as a final validation after individual phases pass.

Run this only if Phases 1–17 have no blockers.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Launch Bubbles and open workspace. | Shell stable and ready. |
| 2 | Confirm MiniMax, Tavily, and voice readiness. | Readiness rail healthy. |
| 3 | Send `Introduce yourself`. | Capabilities response appears; speaks if voice ready. |
| 4 | Send the web search prompt from Phase 4. | Research report with citations. |
| 5 | Ask follow-up: `What are the most important setup risks from that report?` | Answers from previous report. |
| 6 | Send image generation prompt from Phase 5. | Image artifact renders and downloads. |
| 7 | Send music generation prompt from Phase 6. | Audio artifact plays and downloads. |
| 8 | Send landing page prompt from Phase 8. | Approval appears. |
| 9 | Approve landing page. | Local site opens; artifact appears. |
| 10 | Request revision: `Make the hero copy shorter and add a pricing section.` | Revision approval appears. |
| 11 | Approve revision. | Updated local site opens. |
| 12 | Send agent creation prompt from Phase 9. | Agent draft approval appears. |
| 13 | Approve agent creation. | Agent files created; switch prompt appears. |
| 14 | Reply `yes, switch to the new agent`. | New agent active. |
| 15 | Use voice to send `Introduce yourself`. | STT submits; TTS speaks response. |
| 16 | Click `Export redacted logs`. | Logs export without secrets. |

---

## Report Format

When all phases are complete, produce a structured report with the following sections:

### 1. Test Run Metadata

| Field | Value |
|-------|-------|
| Tester | Codex GPT 5.5 Agent |
| Date | [today's date] |
| Build/branch/commit | [from git] |
| macOS version | [from sw_vers] |
| Environment | Local dev |
| MiniMax configured | Yes / No |
| Tavily configured | Yes / No |
| Voice configured | Yes / No |
| Media fixture mode disabled | Yes / No |

### 2. Phase Results Summary

| Phase | Name | Total Tests | Passed | Failed | Skipped |
|-------|------|-------------|--------|--------|---------|
| 0 | Environment Setup | ... | ... | ... | ... |
| 1 | Shell Smoke Test | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |

### 3. Detailed Results

For each test ID, report:

```
[TEST-ID] — [PASS / FAIL / SKIP]
  Observation: [what you saw]
  Evidence: [screenshot filename]
  Notes: [any additional context]
```

### 4. Failure Report

Use one entry per failure:

```
Failure ID: [TEST-ID]
Workflow: [phase name]
Build/commit: [hash]
Prompt or action: [what was done]
Expected: [what should have happened]
Actual: [what actually happened]
Severity: Blocker / High / Medium / Low
Reproducible: Yes / No / Intermittent
Provider involved: MiniMax / Tavily / Gemini / OpenAI / Local app / None
Artifact path or local URL (if safe): [path]
Screenshot evidence: [filename]
Logs attached: Yes / No (redacted only)
Secrets checked/redacted: Yes
Notes: [additional context]
```

### 5. Production Exit Criteria

Mark each as PASS or FAIL:

**Critical:**
- [ ] App launches and workspace is stable
- [ ] MiniMax setup is ready
- [ ] Tavily setup is ready
- [ ] Web search returns live citations
- [ ] Image generation returns a real artifact
- [ ] Music generation returns a playable real artifact
- [ ] Landing-page generation is approval-gated and opens a working local site
- [ ] Agent birth is approval-gated and creates a usable agent
- [ ] Introduce itself works by text
- [ ] Approval approve/deny/cancel all behave safely
- [ ] Artifacts download successfully
- [ ] Logs/errors are redacted
- [ ] No fixture output used in production workflow validation

**Conditional:**
- [ ] Video generation passes (if included)
- [ ] Voice input and TTS pass (if included)
- [ ] Voice approval passes (if included)
- [ ] Setup reset/degraded states pass (if included)

### 6. Known Watch Items Observed

Note any observations about:
- Agent Birth Preview screen vs. chat-triggered path
- Research follow-up depending on in-memory report
- Landing-page revision depending on active session
- Media workflow timing
- Video generation speed
- Static conversation labels
- Missing `task.partial_output`, `tool.requested`, or `approval.accepted` events
- Any fallback text about unavailable services

### 7. Final Verdict

State one of:
- **PRODUCTION READY** — All critical exit criteria pass. Conditional items pass or are out of scope.
- **CONDITIONAL PASS** — All critical exit criteria pass. Some conditional items fail but are documented.
- **NOT READY** — One or more critical exit criteria fail. List the blockers.

---

## Execution Instructions

1. Start at Phase 0 and proceed sequentially through Phase 18.
2. Do not skip phases. If a phase is blocked by a prior failure, note it as BLOCKED and continue.
3. Take screenshots liberally — more evidence is better than less.
4. If you encounter an unexpected crash or hang, restart the app and note the incident.
5. For long-running operations (video generation, landing-page builds), wait patiently. Check every 30 seconds for progress.
6. After Phase 17 (Negative tests), ensure ALL keys and flags are restored before Phase 18.
7. Save the final report as `/Users/dev/Documents/GitHub/Project-Bubbles/production-test-report.md`.
8. Save all screenshots in `/Users/dev/Documents/GitHub/Project-Bubbles/test-evidence/`.

**Begin Phase 0 now.**
