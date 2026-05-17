# Bubbles Production Manual Test Checklist

This checklist is for a manual production-style verification pass across Bubbles workflows. It assumes the tester is using the real Electron app/runtime, real provider credentials, and no fixture media paths.

## 1. Test Run Metadata

Fill this in before starting.

| Field | Value |
| --- | --- |
| Tester |  |
| Date |  |
| Build, branch, or commit |  |
| Environment | Local dev / packaged app / staging |
| macOS version |  |
| Network | Office / home / VPN / restricted |
| MiniMax Token Plan key configured | Yes / No |
| Tavily API key configured | Yes / No |
| Gemini STT key configured | Yes / No |
| OpenAI STT fallback configured | Yes / No |
| Voice approvals enabled | Yes / No |
| Media fixture mode disabled | Yes / No |
| Notes |  |

## 2. Production Preconditions

The manual pass is valid only when these are true.

- [ ] `BUBBLES_MINIMAX_MEDIA_FIXTURE` is unset or explicitly `false`.
- [ ] `BUBBLES_CREATIVE_IMAGE` is not `false`.
- [ ] `BUBBLES_CREATIVE_MUSIC` is not `false`.
- [ ] `BUBBLES_CREATIVE_VIDEO` is not `false` if video is included in this pass.
- [ ] `BUBBLES_CODING_LANDING_PAGE` is not `false`.
- [ ] `BUBBLES_VOICE_ENABLED` is not `false` if voice is included in this pass.
- [ ] `BUBBLES_VOICE_APPROVALS_ENABLED` is not `false` if voice approval is included in this pass.
- [ ] Real MiniMax Token Plan key is stored through the setup UI.
- [ ] Real Tavily API key is stored through the Tavily setup UI.
- [ ] Voice STT key is stored if voice input is included.
- [ ] No raw API keys, task logs, or provider errors containing secrets are copied into test evidence.
- [ ] The app is allowed to access microphone if voice input is included.
- [ ] Browser popups/local URL opening are allowed for landing-page verification.

## 3. Recommended Command Checks

Run these before manual testing when testing from source.

```bash
npm run audit:capabilities
npm run audit:fixtures
npm run typecheck
npm test
```

Pass criteria:

- [ ] Capability audit completes and preload invokes are wired.
- [ ] Fixture audit is reviewed. Known fixture switches may exist in code, but production run does not enable media fixture mode.
- [ ] Typecheck passes, or any known failures are recorded in the test notes.
- [ ] Automated tests pass, or any known failures are recorded in the test notes.

## 4. Launch And Shell Smoke Test

Use this section to confirm the app shell is healthy before workflow testing.

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| SHELL-01 | Launch app | Start the app with `npm run dev` or open the packaged build. | Floating Bubbles avatar appears. No crash dialog appears. | [ ] |
| SHELL-02 | Open workspace | Click the floating avatar. | Assistant panel opens with chat, setup, connectors, task drawer, approvals, memory, and agent rail. | [ ] |
| SHELL-03 | Close workspace | Click the panel close control. Reopen through the avatar. | Panel closes and reopens without losing visible state. | [ ] |
| SHELL-04 | Drag panel/avatar | Drag the window header/avatar area. | Window moves smoothly and remains interactive. | [ ] |
| SHELL-05 | Readiness rail | Inspect the Readiness area. | MiniMax readiness and Tavily connector status are visible and understandable. | [ ] |
| SHELL-06 | Redacted logs export | Click `Export redacted logs`. | Export completes without exposing raw provider keys or tokens. | [ ] |

Evidence to capture:

- App version/build.
- Screenshot of the healthy workspace.
- Any launch or shell error messages, with secrets redacted.

## 5. Setup And Connector Workflow

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| SETUP-01 | MiniMax ready state | In Settings, verify MiniMax setup status. If needed, save a Token Plan key and click `Recheck MiniMax`. | Status shows `MiniMax API is ready.` and chat composer is enabled. | [ ] |
| SETUP-02 | Tavily ready state | Save Tavily API key if needed. Click `Recheck Tavily`. | Tavily status says Remote MCP is ready for live research. Connector shows ready/healthy. | [ ] |
| SETUP-03 | Connector health check | In Connectors, click `Check Tavily Research`. | Connector remains enabled with ready/healthy status. | [ ] |
| SETUP-04 | Connector disconnect/re-enable | Disconnect Tavily, confirm degraded status, then enable/save/recheck again. | Research unavailable state is clear while disconnected, then returns to healthy after re-enable. | [ ] |
| SETUP-05 | Voice setup | Save Gemini STT key and optional OpenAI fallback key. | Voice setup reports voice ready or a clear reason why voice cannot run. | [ ] |
| SETUP-06 | Reset controls | Use reset controls only if this test run includes setup reset validation. | Reset state is visible; re-saving keys restores readiness. | [ ] |

Evidence to capture:

- Screenshot of MiniMax ready.
- Screenshot of Tavily ready.
- Screenshot of voice ready, if voice is in scope.
- Do not capture raw key values.

## 6. Introduce Itself Workflow

Purpose: Verify the simple router path and spoken-response handoff.

Primary prompt:

```text
Introduce yourself
```

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| INTRO-01 | Text introduction | Send `Introduce yourself`. | Bubbles replies that it can plan, remember context, research with Tavily, create images/music/video, build approved landing pages, create agents, manage approvals, and speak with voice. | [ ] |
| INTRO-02 | Avatar state | Observe avatar during/after the response. | Avatar reaches a positive/celebrating state and does not remain stuck in working/listening. | [ ] |
| INTRO-03 | TTS handoff | If voice is enabled, wait for speech playback. | Bubbles speaks the introduction once and returns to voice ready/idle. | [ ] |
| INTRO-04 | Repeat stability | Send `Bubbles, introduce yourself.` | Same capability response path works again without duplicate stuck speech. | [ ] |

Failure checks:

- [ ] If MiniMax is not ready, chat remains disabled with setup guidance.
- [ ] If voice is off, text response still succeeds.

## 7. Web Search Workflow

Purpose: Verify Tavily live research, MiniMax synthesis, citations, memory/timeline persistence, follow-up, and read-aloud.

Primary prompt:

```text
Search for the latest MiniMax Token Plan API capabilities and summarize the practical setup steps with sources.
```

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| SEARCH-01 | Start live research | Send the primary prompt. | Chat records the user prompt. Bubbles starts a research task and does not use canned/fixture output. | [ ] |
| SEARCH-02 | Research result | Wait for completion. | Bubbles returns a structured research report with source citations. | [ ] |
| SEARCH-03 | Citations render | Inspect citations under the assistant message. | Each citation has title/link/snippet where available. Links open externally. | [ ] |
| SEARCH-04 | Task/timeline state | Inspect Task Drawer and Memory/Timeline. | Task completion and research summary are visible. No stuck active task remains. | [ ] |
| SEARCH-05 | Follow-up | Send `What are the most important setup risks from that report?` | Bubbles answers from the prior research report and keeps citations. | [ ] |
| SEARCH-06 | Read research aloud | Send `Read the research output aloud.` | Bubbles reuses the latest research report. If voice is ready, it speaks or queues speech; text remains available. | [ ] |
| SEARCH-07 | Degraded connector | Temporarily disconnect Tavily and send a search prompt. | Bubbles returns clear setup/connector guidance, not a fake report. Re-enable Tavily afterward. | [ ] |

Pass criteria:

- [ ] Report is current enough for the tested topic.
- [ ] Sources are real Tavily results.
- [ ] No raw Tavily key, MiniMax key, stack trace, or unredacted provider payload is shown.
- [ ] Follow-up uses previous research context.
- [ ] Voice read-aloud does not alter the report content.

## 8. Image Generation Workflow

Purpose: Verify live MiniMax image generation, artifact rendering, download, TTS completion, and error handling.

Primary prompt:

```text
Generate an image of a polished glass greenhouse on Mars at sunrise, cinematic but realistic.
```

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| IMAGE-01 | Start image generation | Send the primary prompt. | Chat shows a working message such as image generation in progress. Task Drawer shows received/running status. | [ ] |
| IMAGE-02 | Completion | Wait for completion. | Bubbles says the image is ready. Avatar returns from working to positive state. | [ ] |
| IMAGE-03 | Artifact render | Inspect the image artifact card. | Image preview renders from a local artifact URL/path. It is not an SVG fixture unless intentionally testing fixture mode outside production. | [ ] |
| IMAGE-04 | Download | Click `Download` on the image card. | Status changes to `Saved to Downloads.` and a file appears in Downloads. | [ ] |
| IMAGE-05 | TTS completion | If voice is ready, confirm Bubbles speaks a short completion line once. | Speech says the image is ready and returns to idle/voice ready. | [ ] |
| IMAGE-06 | Disable flag behavior | In a separate run only, set `BUBBLES_CREATIVE_IMAGE=false` and retry. | Bubbles says image generation is disabled. Restore flag after the check. | [ ] |

Pass criteria:

- [ ] Generated file opens outside the app.
- [ ] Artifact title/path are visible enough for tester evidence, but no secrets are exposed.
- [ ] Failed provider responses are redacted and user-readable.

## 9. Music Generation Workflow

Purpose: Verify live MiniMax music generation, audio playback, artifact download, and task lifecycle.

Primary prompt:

```text
Create a short music track for a calm product launch video, modern, warm, and optimistic.
```

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| MUSIC-01 | Start music generation | Send the primary prompt. | Chat shows music generation in progress. Task Drawer shows received/running status. | [ ] |
| MUSIC-02 | Completion | Wait for completion. | Bubbles says the music is ready. No stuck active task remains. | [ ] |
| MUSIC-03 | Audio render | Inspect the audio artifact card. | Audio control appears and can be played. | [ ] |
| MUSIC-04 | Playback | Press play in the audio control. | Audio plays without renderer crash or broken source errors. | [ ] |
| MUSIC-05 | Download | Click `Download` on the audio card. | Status changes to `Saved to Downloads.` and an audio file appears in Downloads. | [ ] |
| MUSIC-06 | TTS completion | If voice is ready, confirm Bubbles speaks a short completion line once. | Speech says the music is ready and returns to idle/voice ready. | [ ] |
| MUSIC-07 | Disable flag behavior | In a separate run only, set `BUBBLES_CREATIVE_MUSIC=false` and retry. | Bubbles says music generation is disabled. Restore flag after the check. | [ ] |

Pass criteria:

- [ ] Audio is a real provider artifact, not a fixture WAV.
- [ ] Playback controls remain usable after download.
- [ ] Errors are shown in chat and do not leave avatar/task state stuck.

## 10. Video Generation Workflow

Purpose: Verify live MiniMax video generation and video artifact handling. This can be a longer-running production test.

Primary prompt:

```text
Generate a short video of ocean waves rolling over black sand at golden hour.
```

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| VIDEO-01 | Start video generation | Send the primary prompt. | Chat shows video generation in progress. Task Drawer shows received/running status. | [ ] |
| VIDEO-02 | Long-running state | Wait during provider processing. | UI remains responsive. The task does not duplicate or disappear unexpectedly. | [ ] |
| VIDEO-03 | Completion | Wait for completion. | Bubbles says the video is ready. | [ ] |
| VIDEO-04 | Video render | Inspect the video artifact card. | Video control appears and loads a local artifact source. | [ ] |
| VIDEO-05 | Playback | Press play in the video control. | Video plays without broken source errors. | [ ] |
| VIDEO-06 | Download | Click `Download` on the video card. | Status changes to `Saved to Downloads.` and a video file appears in Downloads. | [ ] |
| VIDEO-07 | Disable flag behavior | In a separate run only, set `BUBBLES_CREATIVE_VIDEO=false` and retry. | Bubbles says video generation is disabled. Restore flag after the check. | [ ] |

Pass criteria:

- [ ] Video is a real provider artifact, not the fixture bytes output.
- [ ] Long-running state is understandable to a user.
- [ ] Provider failure is redacted and does not crash the renderer.

## 11. Web Landing Page Creation Workflow

Purpose: Verify approval-gated landing-page generation, sandbox checks, local browser open, saved project, artifact link, and revision flow.

Primary prompt:

```text
Build a landing page for Aurora Habit, a focused habit tracker for busy founders.
```

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| LANDING-01 | Request landing page | Send the primary prompt. | Bubbles creates an approval request and says approval is needed before generating/running the landing page. | [ ] |
| LANDING-02 | Approval modal | Inspect the approval panel/modal. | Approval title is `Generate landing page`, risk is visible, preview includes sandbox workflow and request. | [ ] |
| LANDING-03 | Deny path | On a separate run, click `Deny`. | Approval clears. Landing page is not generated. User gets a clear denied/cancelled outcome. | [ ] |
| LANDING-04 | Approve path | Click `Approve`. | Bubbles says it is generating the landing page. Avatar/task state moves to working. | [ ] |
| LANDING-05 | Sandbox checks | Wait for generation, accessibility check, and build. | If checks pass, no raw command output/secrets are shown. If checks fail, user sees a redacted failure explanation. | [ ] |
| LANDING-06 | Browser opens | After success, local browser opens automatically. | Generated page opens at a local URL such as `http://127.0.0.1:<port>`. | [ ] |
| LANDING-07 | Page quality | Inspect first viewport, responsive behavior, visible copy, images, buttons, and layout. | Page is polished, usable, and has no obvious overlap/clipping. | [ ] |
| LANDING-08 | Saved project | Confirm project is saved under Downloads/Bubbles Landing Pages. | Folder exists with managed metadata and built output. | [ ] |
| LANDING-09 | Site artifact | Inspect chat artifact card. | Site artifact shows title/local URL and opens the generated site. | [ ] |
| LANDING-10 | Revision request | Send `Make the hero copy shorter and add a pricing section.` | Bubbles creates a revision approval request. | [ ] |
| LANDING-11 | Revision approval | Approve revision. | Bubbles regenerates, runs checks/build, saves updated project, and reopens local preview. | [ ] |
| LANDING-12 | Revision result | Inspect the reopened page. | Requested changes are visible. The old preview is not confused with the new one. | [ ] |

Pass criteria:

- [ ] File-writing and command-running actions happen only after approval.
- [ ] Generated site stays inside the managed landing-page directory.
- [ ] Remote scripts/fonts are not introduced into generated landing pages.
- [ ] Accessibility/build failures are visible and redacted.
- [ ] Revision prompt is recognized only after an active landing page exists.

## 12. Agent Birth System Workflow

Purpose: Verify chat-triggered agent creation, draft approval, file creation, timeline, optional switch, and agent rail update.

Primary prompt:

```text
Create a research analyst agent for competitive product research.
```

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| AGENT-01 | Start agent birth | Send the primary prompt. | Chat says Bubbles is drafting agent files. Task Drawer shows `task.received` and `task.status` for `agent.create`. | [ ] |
| AGENT-02 | Draft approval | Wait for draft completion. | Approval appears with title like `Create <Agent Name>` and action type equivalent to agent file creation. | [ ] |
| AGENT-03 | Preview content | Inspect approval preview. | Preview includes profile, agent markdown, and skills markdown. No visual/avatar customization instructions appear. | [ ] |
| AGENT-04 | Deny path | On a separate run, click `Deny`. | No new agent is added. Task records denied/cancelled outcome. | [ ] |
| AGENT-05 | Approve path | Click `Approve`. | Agent files are created after approval. Task Drawer shows result/completion. | [ ] |
| AGENT-06 | Switch prompt | Observe chat after approval. | Bubbles asks `Agent Created, Should I switch to new agent`. | [ ] |
| AGENT-07 | Confirm switch | Reply `yes, switch to the new agent`. | Newly created agent becomes active. Agent rail/header show the new agent. Timeline records activation. | [ ] |
| AGENT-08 | Decline switch | On a separate created agent, reply `no, keep current`. | Current agent stays active and Bubbles confirms it. | [ ] |
| AGENT-09 | Use created agent | Send a simple task after activation. | Chat routes through the active agent without errors. | [ ] |

Pass criteria:

- [ ] No files are written before approval.
- [ ] Agent profile is valid and has safe allowed tools/memory/safety rules.
- [ ] Created agent persists after app restart.
- [ ] Agent rail lists the created agent.
- [ ] The system rejects or fails safely if draft includes visual customization instructions.

## 13. General Chat And Planning Workflow

Purpose: Verify baseline MiniMax text behavior outside specialized capabilities.

Primary prompt:

```text
Help me plan a three-step launch checklist for a small desktop app.
```

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| CHAT-01 | General prompt | Send the primary prompt. | Bubbles returns a useful plan without triggering research/media/landing/agent flows. | [ ] |
| CHAT-02 | Empty prompt guard | Try submitting blank input or whitespace. | Nothing is sent; no empty user message appears. | [ ] |
| CHAT-03 | Error behavior | If provider/network fails, observe chat. | Error is user-readable and redacted. App remains usable. | [ ] |
| CHAT-04 | Timeline | Inspect Memory/Timeline after task. | Relevant task started/completed event appears if the runtime records one. | [ ] |

Pass criteria:

- [ ] Prompt is not misclassified into another workflow.
- [ ] Chat remains responsive after the response.

## 14. Memory Workflow

Purpose: Verify explicit memory, automatic extraction, timeline display, and clear memory.

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| MEMORY-01 | Explicit remember | Send `Remember that I prefer concise launch plans with risks listed first.` | Bubbles replies `I'll remember: ...`. Memory panel shows saved user preference. | [ ] |
| MEMORY-02 | Use memory | Send `Plan my next release checklist.` | Response reflects the saved preference when appropriate. | [ ] |
| MEMORY-03 | Automatic memory | Send a message with a durable preference, such as `For future research, I prefer source links grouped by vendor.` | If automatic extraction runs, Memory panel updates without exposing secrets. | [ ] |
| MEMORY-04 | Timeline | Inspect Timeline. | Memory created event appears with readable summary. | [ ] |
| MEMORY-05 | Clear memory | Click `Clear memory`. | Saved memories clear from panel. Subsequent responses should not rely on cleared memory. | [ ] |

Pass criteria:

- [ ] Explicit memory is deterministic.
- [ ] Memory content is redacted.
- [ ] Clear action updates UI without restart.

## 15. Voice Input, TTS, And Barge-In Workflow

Purpose: Verify live microphone capture, STT, chat submission, spoken responses, and interruption.

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| VOICE-01 | Voice ready | Confirm voice status says `Voice ready`. | Voice button is enabled. | [ ] |
| VOICE-02 | Start listening | Click the microphone button or press `CommandOrControl+Shift+Space`. | Status changes to Listening. Captions/partial text appear while speaking if available. | [ ] |
| VOICE-03 | Voice transcript to chat | Say `Introduce yourself`, then stop listening. | Transcript is submitted to chat and Bubbles responds through the intro workflow. | [ ] |
| VOICE-04 | TTS playback | Wait for spoken response. | Status changes to Speaking, audio plays, then returns to Voice ready. | [ ] |
| VOICE-05 | Barge-in | While Bubbles is speaking, start another voice input or stop speaking if available. | Current speech stops cleanly and voice/session state remains usable. | [ ] |
| VOICE-06 | STT fallback | If Gemini quota is unavailable and OpenAI fallback is configured, repeat voice input. | Fallback transcribes or reports a clear fallback failure. | [ ] |
| VOICE-07 | Voice disabled | In a separate run only, set `BUBBLES_VOICE_ENABLED=false`. | Voice controls show Voice off and chat still works by text. Restore flag after the check. | [ ] |

Pass criteria:

- [ ] Microphone permission flow is clear.
- [ ] Captions do not overlap core UI.
- [ ] Voice errors do not crash the app.
- [ ] TTS never repeats indefinitely.

## 16. Voice Approval Workflow

Purpose: Verify pending approvals can be resolved by speech when enabled.

Setup: Start a landing-page or agent-birth workflow and wait until an approval is pending.

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| VAPP-01 | Approve by voice | With approval pending, start voice input and say `approve it`. | Pending approval is approved and the associated workflow continues. | [ ] |
| VAPP-02 | Deny by voice | On a separate pending approval, say `deny it`. | Pending approval is denied and no sensitive action runs. | [ ] |
| VAPP-03 | Cancel by voice | On a separate pending approval, say `cancel that`. | Pending approval is cancelled and action does not run. | [ ] |
| VAPP-04 | Ambiguous voice | Say `maybe later` against a pending approval. | Bubbles asks for clearer approval/denial or directs tester to buttons after repeated ambiguity. | [ ] |
| VAPP-05 | Voice approvals disabled | In a separate run only, disable voice approvals and say `approve it`. | Bubbles says voice approvals are off and buttons must be used. Restore flag after the check. | [ ] |

Pass criteria:

- [ ] Approval status changes exactly once.
- [ ] Workflow continuation matches the resolved decision.
- [ ] Ambiguous speech never executes the action.

## 17. Approval Button Workflow

Purpose: Verify click-based approvals independent of voice.

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| APPROVAL-01 | Approve button | Create a landing-page or agent approval and click `Approve`. | Approval resolves to approved and workflow continues. | [ ] |
| APPROVAL-02 | Deny button | Create a fresh approval and click `Deny`. | Approval resolves to denied and workflow does not continue. | [ ] |
| APPROVAL-03 | Cancel button | Create a fresh approval and click cancel/close on approval card. | Approval resolves to cancelled and workflow does not continue. | [ ] |
| APPROVAL-04 | Double click protection | Click approve/deny rapidly. | Only one decision is accepted. UI shows resolving state and does not duplicate work. | [ ] |
| APPROVAL-05 | Persistence | Restart app while an approval is pending, if supported by the test scope. | Pending approval is still visible or safe state is restored. | [ ] |

Pass criteria:

- [ ] Sensitive workflows never bypass approval.
- [ ] Denied/cancelled actions are not executed.
- [ ] Approval history appears in timeline/memory where expected.

## 18. Artifact Handling Workflow

Purpose: Verify generated artifacts render, open, download, and remain sandboxed.

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| ART-01 | Image artifact | Use completed image workflow. | Image preview loads and download succeeds. | [ ] |
| ART-02 | Audio artifact | Use completed music workflow. | Audio control loads, plays, and download succeeds. | [ ] |
| ART-03 | Video artifact | Use completed video workflow. | Video control loads, plays, and download succeeds. | [ ] |
| ART-04 | Site artifact | Use completed landing-page workflow. | Site artifact opens local generated URL. | [ ] |
| ART-05 | Path safety | Attempt to open/download only through visible artifact controls. | App allows only approved local artifact paths. No arbitrary filesystem path is exposed. | [ ] |
| ART-06 | Downloads naming | Inspect downloaded files. | Names are readable and do not contain unsafe characters. | [ ] |

Pass criteria:

- [ ] Artifact URLs use expected local artifact handling.
- [ ] Broken artifacts produce clear download/render failures.
- [ ] Download status updates correctly.

## 19. Task Drawer And Cancellation Workflow

Purpose: Verify visible task lifecycle and cancellation behavior.

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| TASK-01 | Media task events | Start image/music/video generation. | Task Drawer shows received/running/result or error events. | [ ] |
| TASK-02 | Agent task events | Start agent birth. | Task Drawer shows received/status/approval required/result events. | [ ] |
| TASK-03 | Landing task state | Start landing page flow and approve. | Working state is visible while generation/check/build runs. | [ ] |
| TASK-04 | Cancel active task | Start a long-running task and click cancel if the button is shown. | Task cancellation is reflected in UI or a clear unsupported/unavailable state is shown. | [ ] |
| TASK-05 | Post-task cleanup | After workflow finishes/fails. | Active task clears and avatar does not remain stuck in working/waiting approval. | [ ] |

Pass criteria:

- [ ] Task Drawer tells a coherent story.
- [ ] Error/cancel/result states are distinguishable.

## 20. Agent Switching Workflow

Purpose: Verify switching among existing agents outside the birth prompt.

| ID | Test | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| SWITCH-01 | Existing agent rail | Inspect Agent rail. | General assistant and any persisted agents appear. | [ ] |
| SWITCH-02 | Manual activation | Click an existing non-active agent. | Header/rail update to show active agent. Timeline records activation. | [ ] |
| SWITCH-03 | Chat after switch | Send a normal planning prompt. | Chat remains usable and active agent stays selected. | [ ] |
| SWITCH-04 | Restart persistence | Restart app. | Previously created agents persist. Active agent behavior is acceptable for product expectations. | [ ] |

Pass criteria:

- [ ] Switching does not delete agents or memory.
- [ ] Agent badge/header accurately reflects active agent.

## 21. Negative And Degraded State Matrix

Run these in a separate pass so production-ready keys and flags are restored afterward.

| ID | Scenario | Steps | Expected Result | Pass |
| --- | --- | --- | --- | --- |
| NEG-01 | Missing MiniMax key | Reset Token Plan key and attempt chat/media/landing/agent birth. | Chat disables or workflow returns clear MiniMax setup guidance. | [ ] |
| NEG-02 | Invalid MiniMax key | Save an invalid Token Plan key. | Setup error is redacted and user-readable. | [ ] |
| NEG-03 | Missing Tavily key | Reset Tavily key and send search prompt. | Bubbles says Tavily Research is not connected. | [ ] |
| NEG-04 | Network unavailable | Disconnect network and retry research/media. | Clear provider/network failure; app remains usable. | [ ] |
| NEG-05 | Missing microphone permission | Revoke microphone permission and start voice. | App explains microphone/voice issue and does not crash. | [ ] |
| NEG-06 | Provider timeout | Use a realistic long-running video/agent request. | UI remains responsive and errors are redacted if timeout occurs. | [ ] |
| NEG-07 | Misclassification guard | Send `research bakeries` after a landing page is active. | Request routes to research, not landing-page revision. | [ ] |
| NEG-08 | Fixture guard | Ensure media output is not fixture SVG/WAV/video bytes. | Production test fails if fixture artifact is produced. | [ ] |

## 22. End-To-End Production Demo Script

Use this as a concise full-demo route after individual tests pass.

| Step | Action | Expected Result | Pass |
| --- | --- | --- | --- |
| 1 | Launch Bubbles and open workspace. | Shell is stable and ready. | [ ] |
| 2 | Confirm MiniMax, Tavily, and voice readiness. | Readiness rail is healthy. | [ ] |
| 3 | Send `Introduce yourself`. | Capabilities response appears and speaks if voice is ready. | [ ] |
| 4 | Send web search prompt from Section 7. | Research report with citations appears. | [ ] |
| 5 | Ask a follow-up. | Bubbles answers from previous report. | [ ] |
| 6 | Generate image. | Image artifact renders and downloads. | [ ] |
| 7 | Generate music. | Audio artifact plays and downloads. | [ ] |
| 8 | Build landing page. | Approval appears. | [ ] |
| 9 | Approve landing page. | Local site opens and artifact appears. | [ ] |
| 10 | Request landing-page revision. | Revision approval appears. | [ ] |
| 11 | Approve revision. | Updated local site opens. | [ ] |
| 12 | Create research analyst agent. | Agent draft approval appears. | [ ] |
| 13 | Approve agent creation. | Agent files created and switch prompt appears. | [ ] |
| 14 | Reply `yes, switch to the new agent`. | New agent becomes active. | [ ] |
| 15 | Use voice to send `Introduce yourself`. | STT submits transcript and TTS speaks response. | [ ] |
| 16 | Export redacted logs. | Logs export without secrets. | [ ] |

## 23. Production Exit Criteria

The build is ready for a production demo only when all critical items pass.

Critical pass requirements:

- [ ] App launches and workspace is stable.
- [ ] MiniMax setup is ready.
- [ ] Tavily setup is ready.
- [ ] Web search returns live citations.
- [ ] Image generation returns a real artifact.
- [ ] Music generation returns a playable real artifact.
- [ ] Landing-page generation is approval-gated and opens a working local site.
- [ ] Agent birth is approval-gated and creates a usable agent.
- [ ] Introduce itself works by text.
- [ ] Approval approve/deny/cancel all behave safely.
- [ ] Artifacts download successfully.
- [ ] Logs/errors are redacted.
- [ ] No fixture output is used in production workflow validation.

Conditional pass requirements:

- [ ] Video generation passes if included in release scope.
- [ ] Voice input and TTS pass if voice is included in release scope.
- [ ] Voice approval passes if voice approvals are included in release scope.
- [ ] Setup reset/degraded states pass if setup UX is included in release scope.

## 24. Failure Report Template

Use one entry per failure.

```text
Failure ID:
Workflow:
Build/commit:
Prompt or action:
Expected:
Actual:
Severity: Blocker / High / Medium / Low
Reproducible: Yes / No / Intermittent
Provider involved: MiniMax / Tavily / Gemini / OpenAI / Local app / None
Artifact path or local URL, if safe:
Screenshot/video evidence:
Logs attached: Yes / No, redacted only
Secrets checked/redacted: Yes / No
Notes:
```

## 25. Known Production Watch Items

These are not automatic failures, but testers should watch them closely.

- [ ] Agent Birth Preview screen may not be the primary mounted path; chat-triggered agent birth is the production path to verify.
- [ ] Research follow-up depends on the latest in-memory research report in the active session.
- [ ] Landing-page revision depends on an active landing-page session.
- [ ] Media workflows require real MiniMax provider availability and may take longer than normal chat.
- [ ] Video generation can be slow; capture timing and user-visible status.
- [ ] Static conversation labels in the rail are not evidence of live conversation persistence.
- [ ] Declared task event types `task.partial_output`, `tool.requested`, and `approval.accepted` may not appear in production emitters.
- [ ] Any fallback text that says a service is unavailable should be treated as a valid degraded state only if it matches the configured environment.

