# Bubbles MVP Functional Requirements Document

Analysis date: 2026-05-17

## 1. Purpose

This Functional Requirements Document describes the Bubbles MVP as implemented in the current repository. It translates the codebase into product requirements, user workflows, functional requirements, non-functional requirements, acceptance criteria, and known gaps.

Bubbles is a macOS desktop assistant with a floating animated avatar and an expandable workspace. It helps the user run MiniMax-backed assistant tasks, perform cited Tavily research, generate MiniMax media, create custom agents with approvals, generate local landing pages in a sandbox, use voice input/output, and maintain lightweight memory and timeline context.

## 2. Product Summary

Bubbles should feel like a small desktop companion that stays available above other windows. The compact window shows an animated Bubbles avatar and current assistant caption. The expanded workspace provides chat, agent selection, setup, connector status, voice controls, approvals, task events, memory, and artifacts.

The MVP is provider-backed rather than fixture-backed for live runtime paths:

- MiniMax Token Plan APIs for text, JSON, media, and TTS.
- Tavily Remote MCP for live cited web research.
- Gemini STT with optional OpenAI STT fallback.
- macOS Keychain for secrets.
- sqlite-backed local stores for approvals, connectors, memory, and timeline.

## 3. Goals

1. Provide a friendly always-available desktop assistant surface.
2. Let the user ask typed or spoken requests.
3. Use MiniMax for general text tasks and creative outputs.
4. Use Tavily Remote MCP for live research with citations.
5. Keep sensitive actions approval-gated.
6. Store keys securely and redact secrets from persistent logs/data.
7. Persist useful memory and timeline state locally.
8. Generate and revise local landing pages through a sandboxed, approval-gated workflow.
9. Make generated artifacts visible and downloadable.
10. Keep unconfigured capabilities clear and recoverable rather than silently failing.

## 4. Users and Personas

### 4.1 Primary User: Desktop Builder

The primary user wants a macOS desktop assistant that can help with research, planning, small creative tasks, and lightweight generated artifacts while staying visible and easy to summon.

Needs:

- Fast access from a floating avatar or shortcut.
- Clear setup and health information.
- Safe approvals before sensitive actions.
- Concise spoken responses and full chat output for long answers.
- Downloadable generated outputs.

### 4.2 Secondary User: Product Demo Operator

The demo operator needs reliable MVP flows that show setup, chat, research, voice, media generation, approvals, and memory without exposing secrets.

Needs:

- Predictable status indicators.
- Redacted logs.
- Feature flags for controlled demos.
- Clear unavailable states when providers are not configured.

### 4.3 Technical Maintainer

The maintainer needs a codebase that is testable, auditable, and safe to extend.

Needs:

- Capability map.
- Fixture audit.
- Typed contracts.
- Narrow tests for core logic and IPC.
- Clear provider boundaries.

## 5. Scope

### 5.1 In Scope

- Floating avatar window.
- Expanded assistant workspace.
- Typed chat.
- MiniMax setup and health.
- MiniMax text task runner.
- MiniMax image, music, video, and TTS generation.
- Tavily API key setup and connector enablement.
- Tavily Remote MCP research reports with citations.
- Gemini and OpenAI STT setup.
- Voice input, voice output, shortcut, captions, and barge-in.
- Voice approval resolution.
- Approval lifecycle for agent creation and landing-page generation.
- Agent registry and agent birth.
- Memory and timeline.
- Local artifact display, open, and download.
- Landing-page generation, local preview, and revision.
- Redacted logs and trace events.
- Capability and fixture audit tooling.

### 5.2 Out of Scope

The current MVP intentionally does not include:

- Google Workspace, Gmail, Calendar, Email, Local Files, generic Web Search, or generic MCP command connectors.
- Local MCP fixture connector setup paths.
- MiniMax CLI bridge setup.
- Persistent multi-conversation history.
- Cross-platform secret storage.
- External distribution signing/notarization.
- Fully streamed text output.
- Persistent research follow-up context across restarts.
- User-customizable avatar appearance through agent birth.

## 6. Assumptions and Dependencies

1. The target platform is macOS.
2. Key storage uses macOS Keychain.
3. Live AI features require network connectivity.
4. MiniMax Token Plan key is required for chat/task synthesis, agent birth, research synthesis, media generation, and TTS.
5. Tavily API key is required for live research.
6. Gemini key is preferred for voice input.
7. OpenAI key is optional voice STT fallback.
8. The app stores local data in Electron `userData`.
9. Tests and CI may use fixture media only when explicitly enabled.
10. Live product paths should use real providers or show unavailable/error states.

## 7. Functional Requirements

Priority:

- P0: Required for MVP correctness or safety.
- P1: Required for core user value.
- P2: Important but not blocking core MVP.
- P3: Nice to have or future improvement.

Status:

- Implemented: Behavior exists in current code.
- Partial: Some behavior exists but has a known gap.
- Gap: Requirement is implied by product needs but not fully implemented.

### 7.1 Application Shell and Windowing

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-SHELL-001 | The app shall show a compact floating Bubbles avatar window. | P0 | Implemented |
| FR-SHELL-002 | The avatar window shall be frameless, transparent, always-on-top, and visible on all workspaces. | P1 | Implemented |
| FR-SHELL-003 | Clicking the avatar or speech surface shall open or close the assistant workspace. | P0 | Implemented |
| FR-SHELL-004 | The assistant workspace shall open near the avatar and remain above normal windows. | P1 | Implemented |
| FR-SHELL-005 | The avatar and panel windows shall be draggable through renderer pointer events routed to main window movement IPC. | P1 | Implemented |
| FR-SHELL-006 | The workspace shall expose chat, task drawer, approvals, memory, setup, connector status, voice controls, and agent switching. | P0 | Implemented |
| FR-SHELL-007 | The app shall deny in-window popups and open external URLs in the system browser. | P0 | Implemented |

### 7.2 Avatar and Visual State

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-AVATAR-001 | The avatar shall support all states defined in the core contract: idle, listening, thinking, working, waiting approval, confused, concerned, celebrating, sleeping. | P0 | Implemented |
| FR-AVATAR-002 | The renderer shall normalize unknown avatar states to idle. | P1 | Implemented |
| FR-AVATAR-003 | The Pixi avatar shall use generated sprite metadata and a sprite sheet. | P1 | Implemented |
| FR-AVATAR-004 | The avatar shall continue celebrating until another state is selected or emitted. | P2 | Implemented |
| FR-AVATAR-005 | Voice session state shall temporarily override displayed avatar state. | P1 | Implemented |

### 7.3 Setup and Readiness

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-SETUP-001 | The user shall be able to save a MiniMax Token Plan key. | P0 | Implemented |
| FR-SETUP-002 | The app shall verify the MiniMax key through direct MiniMax HTTPS APIs before marking setup ready. | P0 | Implemented |
| FR-SETUP-003 | The app shall store the MiniMax key in macOS Keychain. | P0 | Implemented |
| FR-SETUP-004 | The app shall persist sanitized MiniMax setup status. | P1 | Implemented |
| FR-SETUP-005 | The user shall be able to retry MiniMax verification. | P1 | Implemented |
| FR-SETUP-006 | The user shall be able to reset the Token Plan key or all MiniMax keys. | P1 | Implemented |
| FR-SETUP-007 | The chat composer shall be disabled until MiniMax setup is ready. | P0 | Implemented |
| FR-SETUP-008 | The setup UI shall surface redacted, user-readable errors. | P0 | Implemented |
| FR-SETUP-009 | The app shall not trust legacy MiniMax CLI/general-API setup statuses as ready. | P0 | Implemented |

### 7.4 Typed Chat and General Tasks

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-CHAT-001 | The user shall be able to submit typed messages from the assistant panel. | P0 | Implemented |
| FR-CHAT-002 | Empty messages shall not be submitted. | P1 | Implemented |
| FR-CHAT-003 | User messages shall be appended to chat. | P0 | Implemented |
| FR-CHAT-004 | General messages shall be routed to a MiniMax-backed task runner when not handled by a specialized capability. | P0 | Implemented |
| FR-CHAT-005 | Task results shall be appended as Bubbles chat messages. | P0 | Implemented |
| FR-CHAT-006 | Task errors shall be shown with normalized user-facing text. | P0 | Implemented |
| FR-CHAT-007 | The task drawer shall show task lifecycle events. | P1 | Implemented |
| FR-CHAT-008 | The user shall be able to cancel an active task. | P1 | Implemented |
| FR-CHAT-009 | Long-running tasks shall update avatar state according to task events. | P1 | Implemented |
| FR-CHAT-010 | The task packet shall include active agent, task type, allowed tools, skills, memory context, and output preference. | P1 | Implemented |

### 7.5 Intent Routing

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-ROUTE-001 | The app shall classify user text into task types using local deterministic rules. | P0 | Implemented |
| FR-ROUTE-002 | Research prompts shall route to Tavily research rather than the general MiniMax task runner. | P0 | Implemented |
| FR-ROUTE-003 | Image, music, and video prompts shall route to MiniMax media generation. | P1 | Implemented |
| FR-ROUTE-004 | Landing-page prompts shall create approval-gated sandbox workflows. | P1 | Implemented |
| FR-ROUTE-005 | Agent creation prompts shall create approval-gated agent birth flows. | P1 | Implemented |
| FR-ROUTE-006 | Removed email/calendar/local-file connector prompts shall not route to removed MCP connectors. | P0 | Implemented |

### 7.6 Tavily Research

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-RESEARCH-001 | The user shall be able to save and verify a Tavily API key. | P0 | Implemented |
| FR-RESEARCH-002 | The app shall store the Tavily key in macOS Keychain. | P0 | Implemented |
| FR-RESEARCH-003 | The app shall expose a Tavily Research connector with enable, disconnect, and health-check actions. | P0 | Implemented |
| FR-RESEARCH-004 | Research shall use Tavily Remote MCP, not local MCP fixtures. | P0 | Implemented |
| FR-RESEARCH-005 | Research shall search with Tavily and extract content from top source URLs. | P1 | Implemented |
| FR-RESEARCH-006 | Research synthesis shall require MiniMax Token Plan key. | P0 | Implemented |
| FR-RESEARCH-007 | Research output shall include citations in chat. | P0 | Implemented |
| FR-RESEARCH-008 | Research output shall be stored as memory/timeline summary. | P1 | Implemented |
| FR-RESEARCH-009 | The user shall be able to ask follow-up questions against the latest research report. | P1 | Implemented |
| FR-RESEARCH-010 | The user shall be able to request the latest research output in chat. | P2 | Implemented |
| FR-RESEARCH-011 | Research follow-up context shall persist across app restarts. | P2 | Gap |

### 7.7 MiniMax Media Generation

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-MEDIA-001 | The user shall be able to request image generation. | P1 | Implemented |
| FR-MEDIA-002 | The user shall be able to request music generation. | P1 | Implemented |
| FR-MEDIA-003 | The user shall be able to request video generation. | P1 | Implemented |
| FR-MEDIA-004 | Media generation shall require a MiniMax Token Plan key. | P0 | Implemented |
| FR-MEDIA-005 | Media generation shall respect feature flags for image, music, and video. | P1 | Implemented |
| FR-MEDIA-006 | The UI shall show a working message while media generation is running. | P1 | Implemented |
| FR-MEDIA-007 | Generated media shall be saved under the app artifact root. | P0 | Implemented |
| FR-MEDIA-008 | Generated media shall be shown in chat as an artifact card. | P0 | Implemented |
| FR-MEDIA-009 | The user shall be able to download generated media to Downloads. | P1 | Implemented |
| FR-MEDIA-010 | Fixture media shall be disabled by default and only enabled through explicit environment flag. | P0 | Implemented |

### 7.8 Voice Input and Output

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-VOICE-001 | Voice can be disabled through `BUBBLES_VOICE_ENABLED=false`. | P0 | Implemented |
| FR-VOICE-002 | The user shall be able to save Gemini STT key. | P1 | Implemented |
| FR-VOICE-003 | The user shall be able to save OpenAI STT fallback key. | P2 | Implemented |
| FR-VOICE-004 | The app shall report voice STT and TTS readiness. | P1 | Implemented |
| FR-VOICE-005 | The user shall be able to start and stop voice input from the UI. | P1 | Implemented |
| FR-VOICE-006 | The user shall be able to start voice input with `CommandOrControl+Shift+Space`. | P1 | Implemented |
| FR-VOICE-007 | The app shall request microphone permission on macOS. | P0 | Implemented |
| FR-VOICE-008 | The app shall avoid sending noise-only captures to STT. | P1 | Implemented |
| FR-VOICE-009 | STT shall use Gemini first when configured. | P1 | Implemented |
| FR-VOICE-010 | STT shall use OpenAI fallback when Gemini fails and OpenAI is configured. | P1 | Implemented |
| FR-VOICE-011 | STT errors shall include reason and retryability metadata. | P1 | Implemented |
| FR-VOICE-012 | Voice output shall use MiniMax TTS. | P1 | Implemented |
| FR-VOICE-013 | The user shall be able to barge in while Bubbles is speaking. | P2 | Implemented |
| FR-VOICE-014 | Captions shall show partial/final voice text and errors. | P1 | Implemented |
| FR-VOICE-015 | Long assistant replies shall be summarized for speech and kept full in chat. | P1 | Implemented |
| FR-VOICE-016 | The documented spoken-response threshold shall match the code. | P2 | Gap |

### 7.9 Voice Approvals

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-VAPP-001 | If an approval is pending, a voice final transcript shall resolve approval instead of sending a chat request. | P1 | Implemented |
| FR-VAPP-002 | Voice approvals shall recognize approve, deny, and cancel variants. | P1 | Implemented |
| FR-VAPP-003 | Unclear approval speech shall reprompt once. | P1 | Implemented |
| FR-VAPP-004 | Repeated unclear approval speech shall fall back to chat buttons. | P1 | Implemented |
| FR-VAPP-005 | Voice approvals can be disabled independently from voice sessions. | P1 | Implemented |

### 7.10 Approvals and Safety

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-APPROVAL-001 | Sensitive actions shall create approval requests before execution. | P0 | Implemented |
| FR-APPROVAL-002 | Approval previews shall be redacted before persistence. | P0 | Implemented |
| FR-APPROVAL-003 | Pending approvals shall be visible in the workspace. | P0 | Implemented |
| FR-APPROVAL-004 | The user shall be able to approve, deny, or cancel pending approvals. | P0 | Implemented |
| FR-APPROVAL-005 | Approval decisions shall be persisted to timeline and memory. | P1 | Implemented |
| FR-APPROVAL-006 | Approved agent creation shall write agent files. | P1 | Implemented |
| FR-APPROVAL-007 | Approved landing-page generation shall run the sandbox workflow. | P1 | Implemented |
| FR-APPROVAL-008 | Denied/cancelled agent creation shall stop execution and clear active task state. | P1 | Implemented |

### 7.11 Agent Management and Agent Birth

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-AGENT-001 | The app shall load available agents from the `agents` directory. | P0 | Implemented |
| FR-AGENT-002 | The user shall be able to activate an agent. | P1 | Implemented |
| FR-AGENT-003 | Agent activation shall be written to timeline. | P2 | Implemented |
| FR-AGENT-004 | New agent drafts shall be generated by MiniMax JSON when possible. | P1 | Implemented |
| FR-AGENT-005 | Agent birth shall reject avatar/body/visual customization. | P0 | Implemented |
| FR-AGENT-006 | Agent birth shall normalize missing profile fields and skills path. | P1 | Implemented |
| FR-AGENT-007 | Agent file creation shall require approval. | P0 | Implemented |
| FR-AGENT-008 | After creation, Bubbles shall ask whether to switch to the new agent. | P2 | Implemented |
| FR-AGENT-009 | The dedicated Agent Birth Preview screen shall be available in the primary workspace UI. | P2 | Gap |

### 7.12 Memory and Timeline

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-MEM-001 | The user shall be able to save explicit memories with `remember ...`. | P1 | Implemented |
| FR-MEM-002 | Explicit memory content shall be redacted before storage. | P0 | Implemented |
| FR-MEM-003 | The app may extract durable memories from user messages after tasks. | P2 | Implemented |
| FR-MEM-004 | Recent memories shall be visible in the workspace. | P1 | Implemented |
| FR-MEM-005 | The user shall be able to clear memory. | P1 | Implemented |
| FR-MEM-006 | Timeline events shall be persisted for tasks, approvals, memory, and agents. | P1 | Implemented |
| FR-MEM-007 | Timeline summaries shall be redacted before storage. | P0 | Implemented |
| FR-MEM-008 | The memory panel shall show saved memories and recent timeline events. | P1 | Implemented |

### 7.13 Landing-Page Generation

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-LP-001 | Landing-page requests shall create an approval before generation. | P0 | Implemented |
| FR-LP-002 | Landing-page generation shall require MiniMax Token Plan key. | P0 | Implemented |
| FR-LP-003 | Landing-page generation can be disabled through `BUBBLES_CODING_LANDING_PAGE=false`. | P1 | Implemented |
| FR-LP-004 | Generated project files shall be limited to `index.html`, `src.css`, `src.js`, and `package.json`. | P0 | Implemented |
| FR-LP-005 | Generated files shall be written only inside the sandbox root. | P0 | Implemented |
| FR-LP-006 | Remote scripts and remote fonts shall be stripped or rejected. | P0 | Implemented |
| FR-LP-007 | `package.json` shall be restricted to approved Vite scripts and dependency. | P0 | Implemented |
| FR-LP-008 | Generated HTML shall include English lang, viewport, H1, image alt text, and visible form label. | P1 | Implemented |
| FR-LP-009 | The sandbox shall run an accessibility check before build. | P1 | Implemented |
| FR-LP-010 | The sandbox shall run Vite build before exposing the page. | P1 | Implemented |
| FR-LP-011 | The generated project shall be copied to Downloads in a managed folder. | P1 | Implemented |
| FR-LP-012 | The generated site shall be served locally and opened in a browser. | P1 | Implemented |
| FR-LP-013 | Follow-up revision prompts shall update the active landing page after approval. | P1 | Implemented |
| FR-LP-014 | The app shall avoid overwriting unmanaged Downloads folders. | P0 | Implemented |

### 7.14 Artifacts

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-ART-001 | Chat shall render image artifacts. | P1 | Implemented |
| FR-ART-002 | Chat shall render video artifacts. | P1 | Implemented |
| FR-ART-003 | Chat shall render audio artifacts. | P1 | Implemented |
| FR-ART-004 | Chat shall render site artifacts as external links. | P1 | Implemented |
| FR-ART-005 | Local artifact URLs shall use the `bubbles-artifact` protocol. | P1 | Implemented |
| FR-ART-006 | Artifact open/download operations shall reject paths outside the artifact root. | P0 | Implemented |
| FR-ART-007 | Downloaded artifact filenames shall be sanitized. | P0 | Implemented |

### 7.15 Logs and Observability

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-OBS-001 | Task logs shall be written to the app log directory. | P1 | Implemented |
| FR-OBS-002 | Task logs shall redact secrets. | P0 | Implemented |
| FR-OBS-003 | Structured trace events shall be written as NDJSON. | P1 | Implemented |
| FR-OBS-004 | Trace event fields shall be redacted recursively. | P0 | Implemented |
| FR-OBS-005 | The user shall be able to open/export the redacted log directory. | P1 | Implemented |
| FR-OBS-006 | Voice, TTS, task, approval, and landing-page steps shall emit trace events. | P2 | Implemented |

### 7.16 Developer Tooling

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-DEV-001 | The repository shall provide a capability audit script. | P1 | Implemented |
| FR-DEV-002 | The repository shall provide a fixture/static workflow audit script. | P1 | Implemented |
| FR-DEV-003 | Root scripts shall support narrow package tests and typechecks. | P1 | Implemented |
| FR-DEV-004 | Tests shall cover core services, Electron IPC, renderer components, and voice flows. | P1 | Implemented |

## 8. User Workflows

### 8.1 First-Run MiniMax Setup

1. User opens the assistant workspace.
2. Setup screen checks MiniMax status.
3. If no key exists, user enters MiniMax Token Plan key.
4. App verifies key through direct MiniMax API.
5. On success, key is stored in Keychain and chat becomes enabled.
6. On failure, setup shows a redacted error and lets user retry or reset.

Acceptance criteria:

- Empty key cannot be saved.
- Invalid key is not stored as verified.
- Network/auth/quota errors are readable and redacted.
- Ready state enables chat.

### 8.2 Tavily Research Setup

1. User enters Tavily API key.
2. App stores key in Keychain.
3. App verifies through Tavily Remote MCP health check.
4. User enables Tavily Research connector.
5. User can run connector health check.

Acceptance criteria:

- Tavily status reaches ready after successful health check.
- Connector health reflects enabled and configured state.
- Errors do not leak raw key.

### 8.3 Voice Setup

1. User enters Gemini STT key.
2. User optionally enters OpenAI STT fallback key.
3. App reports preferred STT provider.
4. App reports MiniMax TTS ready when MiniMax key exists.

Acceptance criteria:

- Voice can show STT ready with Gemini or OpenAI.
- TTS requires MiniMax key.
- Reset actions remove the correct voice keys.

### 8.4 Typed General Task

1. User types a message.
2. App appends user message.
3. Intent classifier determines task type.
4. Specialized routes get first chance.
5. General route builds a task packet.
6. MiniMax generates response.
7. App emits task events and appends assistant answer.
8. Memory extraction runs when setup is ready.

Acceptance criteria:

- Chat is disabled until MiniMax setup is ready.
- Task drawer shows task receipt/running/result or error.
- Cancellation works before or during MiniMax request.
- Provider failures update setup health when relevant.

### 8.5 Research Report

1. User asks to research/search/look up/investigate.
2. App requires MiniMax key and Tavily key.
3. Tavily search runs.
4. Tavily extract runs for top result URLs.
5. MiniMax synthesizes report.
6. Chat shows report and citations.
7. Voice says readiness text rather than reading the full report.
8. Memory/timeline are updated.

Acceptance criteria:

- Missing MiniMax or Tavily key gives clear setup guidance.
- Citations are shown with title, URL, and snippet when available.
- Sources are not invented by the prompt.
- Follow-up questions use latest report context while app remains open.

### 8.6 Media Generation

1. User asks for an image, video, or music.
2. App shows a working chat message and task events.
3. App checks feature flag and MiniMax key.
4. MiniMax media API runs.
5. Artifact is written to app artifact root.
6. Working message is replaced with completion copy.
7. Artifact appears in chat with playback/preview/download controls.

Acceptance criteria:

- Missing MiniMax key fails clearly.
- Disabled feature flag fails clearly.
- Artifact download copies file to Downloads.
- Artifact paths outside artifact root are rejected.

### 8.7 Voice Command

1. User clicks microphone or presses shortcut.
2. App requests microphone access if needed.
3. Renderer records audio until speech ends or timeout.
4. App transcribes audio with Gemini, then OpenAI fallback.
5. Final transcript either resolves approval or submits chat.
6. Bubbles response may be spoken with MiniMax TTS.
7. User may barge in during speech.

Acceptance criteria:

- Noise-only capture does not call STT.
- STT failure shows reason and caption.
- Voice final transcript is deduplicated.
- Long replies are not fully spoken.

### 8.8 Approval Resolution

1. App creates approval for sensitive action.
2. Workspace displays approval title, risk, explanation, and redacted preview.
3. User approves, denies, or cancels.
4. Decision persists to sqlite, timeline, and memory.
5. Approved follow-up action runs when applicable.

Acceptance criteria:

- Pending approval opens/focuses the panel.
- Preview is redacted.
- Denied/cancelled actions do not run.
- Approved landing-page and agent creation run their follow-up flows.

### 8.9 Agent Birth

1. User asks to create an agent.
2. App starts an agent creation task.
3. MiniMax drafts agent profile and markdown.
4. App rejects visual customization attempts.
5. App creates an approval with draft preview.
6. On approval, app writes files to `agents/<id>/`.
7. Bubbles asks if user wants to switch to the new agent.
8. User confirms or declines.

Acceptance criteria:

- Agent profile validates before write.
- Skills path must point to its own agent folder.
- New agent cannot change avatar/body visuals.
- Default agent cannot be archived.

### 8.10 Landing Page

1. User asks for a landing page.
2. App creates approval with workflow preview.
3. On approval, MiniMax generates static Vite files.
4. App repairs/checks generated files.
5. App runs accessibility check.
6. App runs Vite build.
7. App saves to Downloads.
8. App serves the built site locally.
9. Browser opens preview.
10. User can request revisions after approval.

Acceptance criteria:

- Generation is blocked without approval.
- Files stay inside sandbox.
- Unsafe remote scripts/fonts are removed or rejected.
- Unmanaged Downloads folders are not overwritten.
- Revisions use previous generated files when available.

## 9. Data Requirements

### 9.1 Local App State

The current app state shall contain:

- Active task ID.
- Active agent.
- Approvals.
- Avatar state.
- Available agents.
- Connectors.
- Chat messages.
- Recent memories.
- Task events.
- Timeline events.
- Voice state.

### 9.2 Persistent Data

| Data | Persistence |
| --- | --- |
| MiniMax setup status | JSON file under `userData`. |
| MiniMax/Tavily/Gemini/OpenAI keys | macOS Keychain. |
| Approvals | sqlite file under `userData/data`. |
| Connectors | sqlite file under `userData/data`. |
| Memories | sqlite file under `userData/data`. |
| Timeline events | sqlite file under `userData/data`. |
| Task logs | Redacted files under `userData/task-logs`. |
| Artifacts | Files under `userData/artifacts`. |
| Managed landing pages | Downloads/Bubbles Landing Pages. |

### 9.3 Redaction

The app shall redact:

- MiniMax keys matching `sk-...` and `sk-cp-...`.
- Tavily keys matching `tvly-...`.
- Bearer tokens.
- `--api-key` command arguments.
- Secret-looking values in logs, errors, memory, timeline, connector errors, approval previews, and trace fields.

## 10. Non-Functional Requirements

### 10.1 Security

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-SEC-001 | Renderer shall not have Node integration. | P0 | Implemented |
| NFR-SEC-002 | Context isolation shall be enabled. | P0 | Implemented |
| NFR-SEC-003 | Secrets shall be stored outside repository files. | P0 | Implemented |
| NFR-SEC-004 | Local artifact access shall be path-contained. | P0 | Implemented |
| NFR-SEC-005 | Generated landing-page commands shall be allowlisted. | P0 | Implemented |
| NFR-SEC-006 | Electron renderer sandbox should be enabled or consciously risk-accepted. | P1 | Gap |

### 10.2 Privacy

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-PRI-001 | Raw secrets shall not be printed in logs or persisted in memory/timeline. | P0 | Implemented |
| NFR-PRI-002 | Microphone access shall require OS permission. | P0 | Implemented |
| NFR-PRI-003 | Voice captures shall only be transcribed when speech is detected. | P1 | Implemented |
| NFR-PRI-004 | Research and provider calls shall be explicit capability flows. | P1 | Implemented |

### 10.3 Reliability

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-REL-001 | Provider failures shall produce user-visible errors. | P0 | Implemented |
| NFR-REL-002 | MiniMax health failures shall mark setup unhealthy. | P1 | Implemented |
| NFR-REL-003 | Long-running video generation shall poll until success, fail, or timeout. | P1 | Implemented |
| NFR-REL-004 | App shall stop preview servers before quit. | P1 | Implemented |
| NFR-REL-005 | Main-process state should be decomposed to reduce regression risk. | P2 | Gap |

### 10.4 Usability

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-USE-001 | The compact avatar shall remain easy to open and drag. | P1 | Implemented |
| NFR-USE-002 | The workspace shall show setup and degraded state guidance. | P1 | Implemented |
| NFR-USE-003 | The app shall keep long answers in chat and short spoken responses in voice. | P1 | Implemented |
| NFR-USE-004 | Pending approvals shall be prominent. | P0 | Implemented |
| NFR-USE-005 | Static placeholder conversation history should be replaced with real history or removed. | P2 | Gap |

### 10.5 Accessibility

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-A11Y-001 | Major controls shall have labels or aria labels. | P1 | Implemented |
| NFR-A11Y-002 | Chat log shall use live region behavior. | P1 | Implemented |
| NFR-A11Y-003 | Voice captions shall be accessible. | P1 | Implemented |
| NFR-A11Y-004 | Landing pages shall pass built-in HTML accessibility checks. | P1 | Implemented |

### 10.6 Performance

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-PERF-001 | Voice capture shall time out after a bounded duration. | P1 | Implemented |
| NFR-PERF-002 | Task cancellation shall abort active MiniMax requests. | P1 | Implemented |
| NFR-PERF-003 | Video polling shall have maximum attempts. | P1 | Implemented |
| NFR-PERF-004 | Renderer should avoid duplicate voice side effects across avatar and panel windows. | P1 | Implemented |

### 10.7 Testability

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-TEST-001 | Provider clients shall support injected fetch implementations. | P1 | Implemented |
| NFR-TEST-002 | Core stores shall be testable with temp sqlite paths. | P1 | Implemented |
| NFR-TEST-003 | IPC controllers shall be testable with mock handlers. | P1 | Implemented |
| NFR-TEST-004 | Renderer surfaces shall be testable in jsdom. | P1 | Implemented |

## 11. Feature Flags

| Flag | Requirement |
| --- | --- |
| `BUBBLES_VOICE_ENABLED` | If false, voice session controls shall report voice off and not run live voice. |
| `BUBBLES_VOICE_APPROVALS_ENABLED` | If false, spoken approval decisions shall fall back to chat buttons. |
| `BUBBLES_CREATIVE_IMAGE` | If false, image generation requests shall return disabled copy. |
| `BUBBLES_CREATIVE_MUSIC` | If false, music generation requests shall return disabled copy. |
| `BUBBLES_CREATIVE_VIDEO` | If false, video generation requests shall return disabled copy. |
| `BUBBLES_CODING_LANDING_PAGE` | If false, approved landing-page generation shall not run. |
| `BUBBLES_MINIMAX_MEDIA_FIXTURE` | If true-like, media generation shall use deterministic fixture artifacts for test/CI only. |
| `BUBBLES_AGENT_BIRTH_TIMEOUT_MS` | Shall override chat-driven agent birth MiniMax timeout when valid. |
| `BUBBLES_QA_TASK_DELAY_MS` | Shall delay task preflight for QA when valid. |

## 12. Acceptance Criteria by Epic

### Epic A: Setup and Readiness

- MiniMax key can be saved, verified, reset, and retried.
- Chat remains disabled until MiniMax ready.
- Tavily key can be saved and verified.
- Voice keys can be saved and reset independently.
- All setup errors are redacted.

### Epic B: Assistant Workspace

- Avatar window opens and closes panel.
- Panel renders chat, task drawer, approvals, settings, connector state, memory, and agents.
- App state updates reach both windows.
- Window drag works from avatar and panel header.

### Epic C: Task Execution

- General typed task creates task packet and runs MiniMax text.
- Task drawer receives lifecycle events.
- Cancellation works.
- Task result, error, or cancellation updates chat and timeline.

### Epic D: Research

- Missing setup gives actionable error.
- Configured research returns report with citations.
- Follow-up questions use latest report.
- Research summary persists to memory and timeline.

### Epic E: Media

- Image, music, and video prompts route to media APIs.
- Working state is visible while running.
- Successful output appears in chat with correct artifact UI.
- Download copies local artifact to Downloads.

### Epic F: Voice

- Shortcut opens/focuses panel and starts voice capture.
- Voice capture transcribes speech and avoids noise-only STT calls.
- STT fallback works when Gemini is unavailable and OpenAI is configured.
- TTS creates playable artifact URLs.
- Barge-in stops active audio and starts listening.

### Epic G: Approvals

- Agent and landing-page actions create approvals.
- Approval modal shows risk, explanation, preview, and decisions.
- Denied/cancelled actions do not run.
- Approved actions run follow-up workflows.
- Voice approvals handle approve/deny/cancel/unclear paths.

### Epic H: Landing Pages

- Approval is required.
- Generated files pass sandbox checks.
- Accessibility script and Vite build run successfully.
- Managed project is copied to Downloads.
- Local preview opens.
- Revision prompts update active landing page after approval.

### Epic I: Memory and Timeline

- Explicit memory command persists a memory.
- Auto-extracted memories persist when MiniMax is ready.
- Memory clear works.
- Timeline reflects important task, approval, memory, and agent events.

## 13. Current Gaps and Product Decisions Needed

1. Decide whether spoken-response threshold should be 50 or 200 characters, then align code and docs.
2. Decide whether `AgentBirthPreview` should be mounted in the workspace or removed.
3. Replace static conversation history entries with real conversation history or remove the rail section.
4. Decide whether research follow-up continuity must persist across restarts.
5. Decide whether declared task events without emitters are future contracts or should be removed.
6. Decide whether Electron renderer sandbox should be enabled before broader distribution.
7. Decide whether `reaserch-agent` should be migrated to a corrected ID/name.
8. Add packaging hardening and notarization requirements before external macOS release.

## 14. Release Readiness Checklist

- `npm run audit:capabilities` reports all preload invokes wired.
- `npm run audit:fixtures` has no unintended live fixture/static workflow signals.
- `npm run typecheck` passes.
- `npm test` passes.
- MiniMax setup smoke test passes.
- General chat smoke test passes.
- Tavily research smoke test passes with citations.
- Voice STT/TTS smoke test passes.
- Approval button and voice approval smoke tests pass.
- Image/music/video artifact smoke tests pass or are feature-flagged off intentionally.
- Landing-page generation and revision smoke test passes.
- Artifact download smoke test passes.
- Memory and timeline smoke test passes.
- Logs export opens only redacted logs.
- Packaging settings are appropriate for the intended distribution channel.

