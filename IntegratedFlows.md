# Bubbles MVP Integrated Capability Flow Analysis

Analysis date: 2026-05-17

## 1. Purpose

This document analyzes all current Bubbles MVP capabilities by integrated runtime flow. In this context, an integrated flow means a user-reachable capability traced across:

```text
User action -> Renderer UI -> Preload API -> Electron IPC/Main runtime -> Core service -> Provider/storage -> App state broadcast -> User-visible output
```

The goal is to describe what Bubbles can do today, how each capability is wired, what it depends on, what safety gates apply, and where the current MVP still has partial or placeholder behavior.

## 2. Integrated Flow Summary

The current Bubbles capability surface is built around a few shared runtime foundations:

- `appState` in Electron main is the single live state snapshot.
- `window.bubbles` in preload is the renderer-facing API.
- The renderer has two roles: compact avatar window and expanded panel window.
- MiniMax Token Plan setup is the primary readiness gate for chat, text tasks, research synthesis, media generation, agent birth, and TTS.
- Tavily setup and connector enablement gate live research.
- Gemini/OpenAI voice setup gates live speech-to-text.
- Approval service gates sensitive file and command workflows.
- Memory, timeline, task logs, and artifact storage provide continuity and observability.

## 3. Current Capability Inventory

Capability audit confirms these runtime capability groups:

| Group | User Capability | Primary Status |
| --- | --- | --- |
| Shell | Floating avatar, panel window, drag, always-on-top, state sync | Live |
| Setup | MiniMax, Tavily, Gemini, OpenAI key setup and reset | Live |
| Chat | Typed request submission through `app:send-message` | Live |
| Routing | Deterministic intent routing into specialized flows | Live |
| General Tasks | MiniMax text task packet execution | Live, setup-gated |
| Research | Tavily MCP search/extract plus MiniMax report synthesis | Live, setup-gated |
| Media | MiniMax image, music, video generation | Live, setup/flag-gated |
| Voice | Push-to-talk, shortcut, STT, TTS, captions, barge-in | Live, setup/permission-gated |
| Approvals | Pending approval UI, approve, deny, cancel, voice decisions | Live |
| Agent Birth | Generate custom agent drafts, approve file writes, switch agent | Live, approval-gated |
| Landing Pages | Generate, check, build, save, serve, revise local pages | Live, approval-gated |
| Memory | Explicit remember command and optional MiniMax memory extraction | Live |
| Timeline | Persist task, memory, approval, and agent events | Live |
| Artifacts | Render, serve, open, and download generated artifacts | Live |
| Observability | Redacted logs and structured trace events | Live |
| Developer Audits | Capability map and fixture audit scripts | Live |

## 4. Shared Runtime Backbone

### 4.1 State Broadcast Flow

Purpose: Keep avatar and panel windows synchronized.

```text
Main mutates appState
-> broadcastAppState()
-> sendToWindow(avatarWindow, "app:state", appState)
-> sendToWindow(panelWindow, "app:state", appState)
-> Renderer normalizes partial state
-> UI updates chat, avatar, approvals, tasks, memory, connectors, voice status
```

Key modules:

- `apps/desktop/src/main/main.ts`
- `apps/desktop/src/main/ipc/windowMessaging.ts`
- `apps/desktop/src/main/preload.ts`
- `apps/desktop/src/renderer/App.tsx`

Capabilities depending on this flow:

- All chat updates.
- Task status updates.
- Approval visibility.
- Connector readiness.
- Voice status.
- Memory and timeline refresh.
- Avatar state changes.

Maturity: Live.

Important behavior:

- Broadcast skips destroyed windows safely.
- Both avatar and panel can receive the same state.
- Renderer falls back to safe initial state if IPC is unavailable.

Known limitations:

- `appState` is a large mutable object in Electron main.
- State shape is duplicated in renderer global typings.

### 4.2 Window and Shell Flow

Purpose: Keep Bubbles always available as a compact avatar and expandable workspace.

```text
User clicks avatar or speech bubble
-> Renderer calls window.bubbles.togglePanel()
-> panel:toggle IPC
-> Main creates or closes panel BrowserWindow
-> Main sends panel:state
-> Renderer updates avatar expanded state
```

Primary UI:

- `FloatingAvatarWindow`
- `AssistantPanel`
- `WorkspaceHeader`

Main behavior:

- Avatar window is transparent, frameless, always-on-top, non-resizable.
- Panel window is frameless, always-on-top, resizable.
- Panel opens near the avatar.
- Dragging in renderer calls `window:move-by`.

Maturity: Live.

Safety:

- External URLs are opened via `shell.openExternal`.
- In-window popups are denied.
- Renderer has context isolation and no Node integration.

Known limitations:

- Electron `sandbox` is disabled.
- Conversation history in the rail is static rather than backed by persisted conversations.

## 5. Setup and Readiness Flows

### 5.1 MiniMax Setup Flow

Purpose: Establish the main provider key for text, JSON, media, TTS, agent birth, research synthesis, and landing pages.

```text
User enters Token Plan key
-> setup:save-token-plan-key
-> createMiniMaxSetupService.saveTokenPlanKey()
-> verifyMiniMaxApiKey()
-> MiniMax chat completions endpoint
-> Keychain write on success
-> setup status JSON write
-> setup:status broadcast
-> chat becomes enabled when state is ready
```

Primary files:

- `apps/desktop/src/renderer/screens/SetupScreen.tsx`
- `apps/desktop/src/main/ipc/setupIpc.ts`
- `packages/core/src/minimax/setupService.ts`
- `packages/core/src/minimax/minimaxApiClient.ts`
- `packages/core/src/security/secureKeyStore.ts`

Dependencies:

- macOS Keychain.
- Direct MiniMax HTTPS API.
- Electron `userData` for sanitized setup status.

Outputs:

- `SetupStatus`.
- Readiness badge.
- Enabled chat composer.

Safety:

- Failed verification does not mark setup ready.
- Errors are redacted.
- Reset all also cleans up legacy MiniMax General API key.

Maturity: Live.

### 5.2 Tavily Setup and Connector Flow

Purpose: Establish live web research through Tavily Remote MCP.

```text
User enters Tavily key
-> tavily:save-api-key
-> createTavilySetupService.saveApiKey()
-> Keychain write
-> Tavily MCP tavily-search health check
-> tavily:status broadcast
-> syncTavilyConnectorStatus()
-> connectorRegistry.setHealth()
-> app state broadcast
```

Connector enablement:

```text
User clicks Enable Tavily Research
-> connectors:update
-> connectorRegistry.update()
-> connector appears enabled
```

Primary files:

- `apps/desktop/src/renderer/screens/SetupScreen.tsx`
- `apps/desktop/src/renderer/screens/ConnectorSettings.tsx`
- `apps/desktop/src/main/ipc/tavilySetupIpc.ts`
- `apps/desktop/src/main/ipc/connectorIpc.ts`
- `packages/core/src/connectors/tavilySetupService.ts`
- `packages/core/src/connectors/connectorRegistry.ts`
- `packages/core/src/connectors/tavilyMcpClient.ts`

Dependencies:

- Tavily API key.
- Tavily Remote MCP URL.
- Connector sqlite store.

Outputs:

- `TavilySetupStatus`.
- `ConnectorConfig` with health/auth states.

Safety:

- Tavily key stored in Keychain.
- MCP errors redacted and normalized.
- Removed legacy connectors are not seeded.

Maturity: Live.

### 5.3 Voice Setup Flow

Purpose: Establish STT and TTS readiness.

```text
User enters Gemini or OpenAI key
-> voice-setup:save-gemini-key or voice-setup:save-openai-key
-> createVoiceSetupService.saveKey()
-> Keychain write
-> VoiceSetupStatus rebuild
-> voice-setup:status broadcast
```

Primary files:

- `apps/desktop/src/renderer/screens/SetupScreen.tsx`
- `apps/desktop/src/main/ipc/voiceSetupIpc.ts`
- `packages/core/src/voice/voiceSetupService.ts`
- `packages/core/src/security/secureKeyStore.ts`

Dependencies:

- Gemini key for preferred STT.
- OpenAI key for fallback STT.
- MiniMax key for TTS readiness.

Outputs:

- `VoiceSetupStatus`.
- Voice readiness messaging.

Safety:

- Keys are stored separately.
- Empty keys are rejected with setup errors.
- Reset controls are provider-specific.

Maturity: Live.

## 6. Message Ingress and Routing Flow

This is the central integration path for typed chat and final voice transcripts.

```text
Renderer submitUserText()
-> app:send-message
-> registerWindowIpc handler
-> trim and reject empty text
-> handleRememberCommand()
-> routeCapabilityFlow()
-> taskController.startTask() if not handled
-> extractMemoriesFromMessage() asynchronously
-> app state broadcast
```

Routing precedence:

1. Empty message guard.
2. Explicit memory command.
3. Pending agent switch confirmation or denial.
4. Read latest research report request.
5. Research follow-up question.
6. Landing-page revision prompt.
7. Agent creation request.
8. Capability router for research, media, landing-page approval, creative MiniMax status, agent-create guidance.
9. General MiniMax task runner fallback.

Primary files:

- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/main/main.ts`
- `packages/core/src/orchestration/intentClassifier.ts`
- `packages/core/src/orchestration/flowRouter.ts`
- `apps/desktop/src/main/ipc/taskIpc.ts`

Why this matters:

- It prevents research/media/agent/landing-page prompts from being swallowed by generic text tasks.
- It lets memory commands execute without provider calls.
- It lets pending follow-up decisions override normal chat routing.

Maturity: Live.

Known risks:

- Routing is regex-based and can misclassify ambiguous prompts.
- Several special cases live in the main process rather than a smaller router module.

## 7. Capability Flow Analyses

### 7.1 Explicit Memory Capability

User capability: "Remember that my preference is X."

Integrated flow:

```text
Typed or voice transcript
-> app:send-message
-> parseExplicitRememberCommand()
-> memoryStore.create()
-> timelineStore.append(memory_created)
-> appState.messages append user and Bubbles confirmation
-> avatarState celebrating
-> hydrateMemoryState()
-> app state broadcast
```

Entry points:

- Chat composer.
- Voice transcript after STT.

Core services:

- `parseExplicitRememberCommand`
- `createSqliteMemoryStore`
- `createSqliteTimelineStore`

Storage:

- `memory.sqlite`
- `timeline.sqlite`

Safety:

- Memory content is redacted before storage.

Output:

- Chat confirmation.
- Memory rail update.
- Timeline event.

Maturity: Live.

Known limitations:

- No per-memory delete or edit.
- Clear memory deletes all memory.

### 7.2 Automatic Memory Extraction Capability

User capability: Bubbles may remember durable context from normal messages.

Integrated flow:

```text
General task submitted
-> taskController.startTask()
-> extractMemoriesFromMessage() in background
-> setupService.getStatus()
-> MiniMax JSON memory extraction
-> memoryStore.create() for each normalized item
-> timelineStore.append(memory_created)
-> hydrateMemoryState()
-> app state broadcast
```

Dependencies:

- MiniMax setup ready.
- Token Plan key available.
- Memory and timeline stores initialized.

Safety:

- Extraction failures return no memories.
- Memory content is redacted before persistence.

Output:

- Recent memory rail updates.

Maturity: Live.

Known limitations:

- Extraction is best-effort and silent on failure.
- No user confirmation before inferred memory creation.

### 7.3 General MiniMax Task Capability

User capability: Ask Bubbles a general question, plan, code-related request, or unsupported connector-like request.

Integrated flow:

```text
app:send-message not handled by capability routing
-> taskController.startTask()
-> classifyIntent()
-> buildTaskPacket()
-> load active agent profile and skills
-> query memory context
-> preflightMiniMaxApi()
-> createMiniMaxTaskRunner()
-> generateMiniMaxText()
-> task events emitted
-> task logs written
-> appState messages updated
-> memory/timeline final task persisted
```

Entry points:

- Chat composer.
- Voice transcript.

Primary files:

- `apps/desktop/src/main/ipc/taskIpc.ts`
- `packages/core/src/tasks/taskPacketBuilder.ts`
- `packages/core/src/minimax/minimaxTaskRunner.ts`
- `packages/core/src/minimax/minimaxApiClient.ts`

Provider:

- MiniMax chat completions.

Task events:

- `task.received`
- `task.status`
- `task.result`
- `task.error`
- `task.cancelled`

Avatar integration:

- Received -> thinking.
- Running -> working.
- Result -> celebrating.
- Error -> concerned.
- Cancelled -> idle.

Safety:

- Preflight checks MiniMax readiness.
- Provider errors are categorized and redacted.
- Cancellation uses `AbortController`.
- Logs are redacted.

Maturity: Live.

Known limitations:

- No streaming partial output yet.
- `task.partial_output`, `tool.requested`, and `approval.accepted` are declared but not emitted in production.

### 7.4 Tavily Research Capability

User capability: Ask Bubbles to research, search, look up, investigate, or find sources.

Integrated flow:

```text
app:send-message
-> routeCapabilityFlow()
-> createFlowRouter().route()
-> runTavilyResearch()
-> get MiniMax key and Tavily key
-> connectorRegistry.get("tavily-research")
-> createTavilyResearchConnector()
-> Tavily MCP tavily-search
-> Tavily MCP tavily-extract for top URLs
-> createResearchService().createReport()
-> MiniMax text synthesis
-> latestResearchReport set in memory
-> persistResearchReport()
-> chat report with citations
-> memory/timeline update
```

Entry points:

- Typed prompt.
- Voice transcript.

Core services:

- `createTavilyRemoteMcpClient`
- `createTavilyResearchConnector`
- `createResearchService`
- `createFlowRouter`

Providers:

- Tavily Remote MCP.
- MiniMax text generation.

Storage:

- Keychain for keys.
- Connector sqlite for connector state.
- Memory/timeline sqlite for report summaries.

Outputs:

- Full report in chat.
- Citation cards.
- Short voice text: research output ready.
- Timeline and memory summary.

Safety:

- Requires real Tavily setup.
- No generic web-search fixture connector.
- Tavily and MiniMax errors are redacted.
- Prompt instructs MiniMax not to invent sources.

Maturity: Live.

Known limitations:

- Latest report context is in-memory only.
- Research follow-up across app restarts is not implemented.
- Research is only available through Tavily.

### 7.5 Research Follow-Up Capability

User capability: Ask a follow-up question about the latest research result.

Integrated flow:

```text
app:send-message
-> routeCapabilityFlow()
-> latestResearchReport exists
-> isResearchFollowUp(userText)
-> MiniMax key check
-> createResearchService().answerFollowUp()
-> latestResearchReport replaced with answer
-> persistResearchReport()
-> chat answer with original citations
-> memory/timeline refresh
```

Dependencies:

- Prior research report in current app runtime.
- MiniMax key.

Output:

- Follow-up answer in chat with citations.

Maturity: Live for same session.

Known limitations:

- No persisted full report lookup after restart.
- Follow-up detection is regex-based and may intercept general questions after a research report.

### 7.6 Research Read-Aloud Capability

User capability: Ask Bubbles to read or show the research output.

Integrated flow:

```text
app:send-message
-> routeCapabilityFlow()
-> latestResearchReport exists
-> isReadResearchPrompt(userText)
-> append full latest report to chat
-> avatarState celebrating
-> app state broadcast
```

Maturity: Live.

Important distinction:

- This puts the full report in chat.
- Voice playback policy still prevents long report narration unless explicitly changed.

### 7.7 Image Generation Capability

User capability: Generate an image, poster, logo, mockup, picture, or illustration.

Integrated flow:

```text
app:send-message
-> routeCapabilityFlow()
-> classifyIntent() returns creative.image
-> optimistic working chat message and task events
-> createFlowRouter().route()
-> runCreativeCapability({ kind: "image" })
-> feature flag check
-> MiniMax key check
-> createMiniMaxCreativeService().run()
-> MiniMax image_generation endpoint
-> write PNG under artifact root
-> replace working message with result and artifact
-> task.result event
-> timeline task_completed
-> artifact card in chat
```

Dependencies:

- MiniMax Token Plan key.
- `BUBBLES_CREATIVE_IMAGE` not false.
- Artifact root.

Outputs:

- Image artifact.
- Download button.
- One-shot voice completion text.

Safety:

- Missing key returns clear message.
- Disabled flag returns clear message.
- Artifact download path is contained.
- Fixture output only if explicit fixture flag is set.

Maturity: Live.

### 7.8 Music Generation Capability

User capability: Generate music, song, track, audio, background music, or theme.

Integrated flow:

```text
creative.music intent
-> working message and task events
-> runCreativeCapability({ kind: "music" })
-> createMiniMaxCreativeService().run()
-> MiniMax music_generation endpoint
-> write MP3 under artifact root
-> chat audio artifact card
-> timeline/task completion
```

Dependencies:

- MiniMax key.
- `BUBBLES_CREATIVE_MUSIC` not false.

Outputs:

- Audio player in chat.
- Download button.
- Voice completion text.

Maturity: Live.

### 7.9 Video Generation Capability

User capability: Generate a video, clip, animation, short film, or film.

Integrated flow:

```text
creative.video intent
-> working message and task events
-> runCreativeCapability({ kind: "video" })
-> MiniMax video_generation endpoint
-> poll query/video_generation
-> retrieve file download URL
-> download video bytes
-> write MP4 under artifact root
-> chat video artifact card
-> timeline/task completion
```

Dependencies:

- MiniMax key.
- `BUBBLES_CREATIVE_VIDEO` not false.
- Video polling config.

Outputs:

- Video player in chat.
- Download button.
- Voice completion text.

Safety:

- Provider failure and timeout are redacted and shown as task errors.

Maturity: Live.

Known limitations:

- No visible fine-grained polling progress beyond working message and task status.

### 7.10 Voice Input Capability

User capability: Speak to Bubbles.

Integrated flow:

```text
User clicks mic or presses CommandOrControl+Shift+Space
-> voice:start-session or voice:barge-in
-> renderer microphone permission request
-> getUserMedia()
-> MediaRecorder capture
-> VAD detects speech/silence
-> audioBlobToWavDataUrl()
-> voice:transcribe-audio
-> createVoiceTranscriptionService()
-> Gemini STT first
-> OpenAI STT fallback if configured
-> voice.final event
-> renderer handleFinalTranscriptOnce()
-> approval resolution or app:send-message
```

Entry points:

- `VoiceControls`.
- Global shortcut registered by main process.

Providers:

- Gemini STT.
- OpenAI translation fallback.

Safety:

- Voice can be disabled by flag.
- Microphone permission is requested on macOS.
- Noise-only captures are not sent to STT.
- STT errors preserve reason and retryability.

Output:

- Captions.
- Chat request or approval decision.
- Voice state changes.

Maturity: Live.

Known limitations:

- Browser APIs must be available in renderer.
- Always-listening mode exists in types/logic but UI no longer exposes a wake phrase toggle.

### 7.11 Voice Output and TTS Capability

User capability: Hear Bubbles speak concise responses.

Integrated flow:

```text
New assistant reply
-> useVoiceSession decides whether to speak
-> prepareSpokenResponse()
-> voice:speak
-> speakWithMiniMax()
-> createMiniMaxTtsService().speak()
-> MiniMax t2a_v2 endpoint
-> write MP3 under artifacts/tts
-> return bubbles-artifact URL
-> renderer Audio playback
```

Dependencies:

- Voice enabled.
- MiniMax key.
- Browser audio playback allowed.

Outputs:

- MP3 TTS artifact.
- Audio playback.
- Caption text.

Safety:

- Long replies use chat-panel prompt instead of reading full text.
- TTS errors are redacted.
- `voice:stop-speaking` and barge-in can interrupt.

Maturity: Live.

Known mismatch:

- Code threshold is 200 characters.
- Setup guide currently says 50 normalized characters.

### 7.12 Voice Approval Capability

User capability: Approve, deny, or cancel a pending approval by voice.

Integrated flow:

```text
Pending approval exists
-> voice.final transcript
-> renderer detects pendingApproval
-> voice:resolve-approval
-> createVoiceApprovalResolver().resolve()
-> classifyApprovalVoiceDecision()
-> approvalService approve/deny/cancel if clear
-> handleApprovalResolved()
-> state refresh and follow-up action if approved
```

Safety:

- Voice approvals can be disabled independently.
- Unclear speech reprompts once.
- Second unclear attempt falls back to chat buttons.
- Approval buttons remain available.

Maturity: Live.

### 7.13 Approval System Capability

User capability: Review and decide sensitive actions.

Integrated flow:

```text
Capability creates approval
-> approvalService.create()
-> sqlite insert with redacted preview
-> appState.approvals update
-> presentApprovalPopupWindow()
-> ApprovalModal renders pending card
-> approvals:approve/deny/cancel
-> approvalService resolves status
-> approval history memory/timeline
-> handleApprovalResolved()
```

Used by:

- Agent birth file creation.
- Landing-page file generation and shell command workflow.
- Potential future file/write/external-send flows.

Safety:

- Risk classification.
- Redacted previews.
- Denied/cancelled flows do not run follow-up action.

Maturity: Live.

Known limitation:

- `approval.accepted` task event exists in type contract but is not emitted.

### 7.14 Agent Switching Capability

User capability: Choose active agent.

Integrated flow:

```text
User clicks agent chip
-> agents:activate
-> agentRegistry.activate()
-> timelineStore.append(agent_activated)
-> hydrateAgentState()
-> hydrateMemoryState()
-> app state broadcast
```

Agent registry:

- Loads `agents/<id>/agent.json`.
- Validates profile.
- Lists non-archived agents.

Maturity: Live.

Known limitations:

- Agent `allowedTools` are descriptive labels for MiniMax task packet context, not independent executable tool adapters.
- Existing `reaserch-agent` ID/name are misspelled.

### 7.15 Agent Birth Capability

User capability: Create a new custom agent.

Integrated flow:

```text
app:send-message
-> classifyIntent() returns agent.create
-> createAgentBirthApprovalFromRequest()
-> createAgentBirthDraftingTaskEvents()
-> MiniMax key check
-> createAgentBirthService().preview()
-> generateMiniMaxJson()
-> validate and reject visual customization
-> fallback recommended draft if MiniMax unavailable
-> approvalService.create(agent_file_create)
-> pendingAgentDrafts.set(approval.id, draft)
-> ApprovalModal
-> approve
-> handleApprovalResolved()
-> agentRegistry.create()
-> timeline agent_created
-> task.result
-> ask "Agent Created, Should I switch to new agent"
-> user confirms or denies
-> activate or keep current
```

Safety:

- Requires MiniMax key.
- Requires approval before file writes.
- Agent schema rejects unsupported and visual customization fields.
- Skills path must be under the agent's own directory.

Outputs:

- New files in `agents/<id>/`.
- Agent list update.
- Optional activation.

Maturity: Live via chat.

Partial surface:

- `AgentBirthPreview` is implemented and tested but not mounted in the primary workspace.

### 7.16 Landing-Page Generation Capability

User capability: Generate a local landing page.

Integrated flow:

```text
app:send-message
-> classifyIntent() returns coding.landing_page
-> createFlowRouter().route()
-> approvalService.create(shell_command)
-> pendingLandingPageActions.set()
-> ApprovalModal
-> approve
-> handleApprovalResolved()
-> runApprovedLandingPageAction()
-> feature flag and MiniMax key check
-> assertWorkflowCommandsAllowed()
-> createLandingPageRunner()
-> MiniMax code generator or safe fallback
-> normalize, repair, and check generated files
-> write sandbox files
-> run accessibility-check.mjs
-> run Vite build
-> copy managed project to Downloads
-> createStaticSiteServer()
-> open local browser preview
-> activeLandingPageSession set
-> chat artifact with site URL
```

Safety:

- Approval required before file writes and commands.
- Sandbox path containment.
- Generated file allowlist.
- Approved command allowlist.
- Remote scripts and fonts stripped/rejected.
- Package JSON restricted.
- Accessibility checks before build.
- Managed Downloads metadata prevents overwriting unmanaged folders.

Outputs:

- Local Vite project in Downloads.
- Local preview server URL.
- Site artifact in chat.
- Revision context stored in active session.

Maturity: Live.

Known limitations:

- Safe fallback template exists if MiniMax returns malformed/slow output.
- Generated page quality depends on MiniMax/fallback and basic repair checks, not full browser visual QA.

### 7.17 Landing-Page Revision Capability

User capability: Tell Bubbles what to change after a generated landing page opens.

Integrated flow:

```text
Active landing page session exists
-> user sends revision-like prompt
-> isLandingPageRevisionPrompt()
-> approvalService.create(shell_command, revision preview)
-> pendingLandingPageActions stores request and changeRequest
-> approval
-> runApprovedLandingPageAction()
-> previousFiles passed to generator
-> rebuild, resave, reserve local preview
```

Maturity: Live.

Known limitations:

- Revision detection is regex-based.
- Only active in current runtime session.

### 7.18 Artifact Capability

User capability: View, play, open, or download generated outputs.

Integrated flow:

```text
Provider writes artifact under artifactRoot
-> artifact metadata attached to chat message
-> ChatSurface renders by kind
-> local src uses bubbles-artifact://local/<encoded-path>
-> protocol handler path containment
-> media/image/site displays
-> download button calls capabilities:download-artifact
-> path containment
-> copy to Downloads with sanitized filename
```

Artifact types:

- Image.
- Audio.
- Video.
- Site.

Safety:

- Local artifact open/download rejects paths outside artifact root.
- HTTP(S) site URLs are opened externally.
- Downloads use sanitized filenames.

Maturity: Live.

### 7.19 Connector Management Capability

User capability: See, enable, check, or disconnect Tavily Research.

Integrated flow:

```text
WorkspaceStatusRail renders ConnectorSettings
-> connectors:list from app state
-> User enable/check/disconnect
-> connectors:update/healthCheck/disconnect
-> connectorRegistry sqlite update
-> onChanged hydrates connector state
-> app state broadcast
```

Maturity: Live.

Scope:

- Tavily Research only.

Safety:

- Removed connectors are not seeded.
- Generic MCP fixture connectors are absent.

### 7.20 Logs and Observability Capability

User capability: Export redacted logs for debugging.

Integrated flow:

```text
User clicks Export redacted logs
-> logs:export-redacted
-> ensure taskLogDir
-> shell.openPath(taskLogDir)
```

Trace producers:

- Voice events.
- TTS events.
- Task events.
- Approval resolution.
- Landing-page sandbox steps.

Storage:

- `task-logs/<taskId>.log`.
- `task-logs/observability.ndjson`.

Safety:

- Trace fields redacted recursively.
- Task logs redacted before append.

Maturity: Live.

### 7.21 Developer Audit Capabilities

User capability: Understand or verify current wiring.

Capability audit:

```text
npm run audit:capabilities
-> prints root scripts, env flags, IPC handlers, preload invokes, task types, task events, connectors, voice types, agents
```

Fixture audit:

```text
npm run audit:fixtures
-> prints explicit fixture switches, static demo UI, unavailable/stub copy, stale connector mentions, weak tool evidence, unemitted task events
```

Maturity: Live.

Current audit findings to keep visible:

- All preload invokes are wired.
- Tavily is the only connector.
- Media fixture path exists behind explicit flag.
- Static conversation history remains.
- `task.partial_output`, `tool.requested`, and `approval.accepted` have no production emitter.

## 8. Cross-Flow Dependency Matrix

| Capability | MiniMax Key | Tavily Key | Voice Key | Approval Service | Memory/Timeline | Artifact Root | External Provider |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shell/windowing | No | No | No | No | No | No | No |
| MiniMax setup | Input | No | No | No | No | No | MiniMax |
| Tavily setup | No | Input | No | No | No | No | Tavily MCP |
| Voice setup | TTS readiness | No | Input | No | No | No | None at setup |
| General task | Yes | No | No | No | Yes | No | MiniMax |
| Research | Yes | Yes | Optional for voice input | No | Yes | No | Tavily MCP, MiniMax |
| Image generation | Yes | No | Optional for voice input | No | Timeline | Yes | MiniMax |
| Music generation | Yes | No | Optional for voice input | No | Timeline | Yes | MiniMax |
| Video generation | Yes | No | Optional for voice input | No | Timeline | Yes | MiniMax |
| Voice STT | No | No | Yes | Maybe | No | No | Gemini/OpenAI |
| Voice TTS | Yes | No | No | No | No | Yes | MiniMax |
| Approval decisions | No | No | Optional | Yes | Yes | No | No |
| Agent birth | Yes | No | Optional | Yes | Yes | No | MiniMax |
| Landing page | Yes | No | Optional | Yes | Timeline | Yes | MiniMax, local commands |
| Artifacts | No | No | No | No | No | Yes | No |
| Logs | No | No | No | No | No | No | No |

## 9. Capability Maturity Classification

### 9.1 Live and Core

These capabilities are fully integrated and user-reachable:

- Floating avatar and assistant panel.
- MiniMax setup.
- Typed chat.
- General MiniMax task runner.
- Tavily setup and research connector.
- Tavily research reports.
- MiniMax media generation.
- Voice input/output.
- Approval modal and button decisions.
- Voice approvals.
- Agent switching.
- Chat-driven agent birth.
- Landing-page generation and revision.
- Memory and timeline.
- Artifact rendering/downloads.
- Redacted logs.

### 9.2 Setup-Gated Live

These are live but intentionally unavailable until configured:

- General MiniMax tasks.
- Research synthesis.
- Media generation.
- Agent birth.
- Landing-page generation.
- TTS.
- STT.

### 9.3 Approval-Gated Live

These are live but intentionally paused until explicit user approval:

- Agent file creation.
- Landing-page file generation, checks, build, save, serve, and revisions.

### 9.4 Partial or UX-Incomplete

These work technically but have product gaps:

- Dedicated `AgentBirthPreview` screen exists but is not mounted.
- Conversation history is static.
- Research follow-up state is not persisted across restarts.
- Video generation has limited progress visibility.
- Auto memory extraction has no confirmation or edit path.

### 9.5 Declared But Not Production-Emitted

These task event contracts exist but are not emitted in production:

- `task.partial_output`
- `tool.requested`
- `approval.accepted`

### 9.6 Test/CI or Dev-Oriented

These are intentional non-live or dev/test affordances:

- `BUBBLES_MINIMAX_MEDIA_FIXTURE`.
- `fixture-transcript` provider type in voice IPC typing.
- Renderer fallback echo behavior when `window.bubbles` is absent.
- Capability and fixture audit scripts.

## 10. Integrated Flow Risks

### 10.1 Main Process Concentration

Many integrated flows converge inside `apps/desktop/src/main/main.ts`. This makes the product easy to trace in one place but increases coupling.

Risk:

- A change to one capability can accidentally affect routing, state broadcast, or approval follow-up behavior.

Recommendation:

- Extract runtime modules for research, media, landing pages, agent birth, voice, setup, and app-state broadcasting.

### 10.2 Routing Ambiguity

Intent routing is regex-based.

Risk:

- Follow-up questions after research can intercept ordinary chat.
- Landing-page revision prompts can misclassify broad edit-like language.

Recommendation:

- Add route diagnostics in task logs and consider a small structured route result UI/debug view.

### 10.3 Contract Drift

Renderer `global.d.ts` duplicates core types.

Risk:

- IPC payload and renderer type expectations can drift from core contracts.

Recommendation:

- Export renderer-safe API contract types from a shared module.

### 10.4 Fixture and Static Surface Debt

Fixture audit finds explicit fixture switches, static conversation history, and unavailable copy.

Risk:

- Demo or production users may see stale static labels.

Recommendation:

- Replace static conversation history with real history or hide it.
- Keep fixture media strictly test/CI gated.

### 10.5 Documentation Drift

Voice spoken-response threshold differs between code and setup guide.

Risk:

- QA and users may expect different voice behavior than runtime implements.

Recommendation:

- Decide between 50 and 200 characters and align docs/tests/code.

## 11. Capability Flow Traceability Table

| Flow | UI Surface | Preload/API | Main Runtime | Core Service | Output |
| --- | --- | --- | --- | --- | --- |
| Open panel | Avatar | `togglePanel` | `panel:toggle` | None | Panel window |
| Move window | Avatar/panel header | `moveWindowBy` | `window:move-by` | None | Window position |
| MiniMax setup | Setup screen | `setup.*` | setup IPC | `createMiniMaxSetupService` | Setup status |
| Tavily setup | Setup screen | `tavilySetup.*` | Tavily setup IPC | `createTavilySetupService` | Tavily status |
| Voice setup | Setup screen | `voiceSetup.*` | Voice setup IPC | `createVoiceSetupService` | Voice setup status |
| Chat message | Chat surface | `sendMessage` | `app:send-message` | Router/task services | Chat response |
| General task | Chat/voice | `sendMessage` | task controller | `createMiniMaxTaskRunner` | Task result |
| Research | Chat/voice | `sendMessage` | `runTavilyResearch` | Tavily/research services | Report with citations |
| Research follow-up | Chat/voice | `sendMessage` | latest report branch | `answerFollowUp` | Follow-up answer |
| Image | Chat/voice | `sendMessage` | `runCreativeCapability` | `createMiniMaxCreativeService` | Image artifact |
| Music | Chat/voice | `sendMessage` | `runCreativeCapability` | `createMiniMaxCreativeService` | Audio artifact |
| Video | Chat/voice | `sendMessage` | `runCreativeCapability` | `createMiniMaxCreativeService` | Video artifact |
| Voice input | Voice controls/shortcut | `voice.*` | voice IPC | STT service | Transcript |
| Voice output | Voice hook | `voice:speak` | `speakWithMiniMax` | TTS service | Audio URL |
| Approval buttons | Approval modal | `approvals.*` | approval IPC | `createApprovalService` | Decision and follow-up |
| Voice approval | Voice hook | `voice:resolve-approval` | approval voice IPC | voice approval resolver | Decision and follow-up |
| Agent switch | Agent rail | `agents:activate` | agent handler | `agentRegistry.activate` | Active agent |
| Agent birth | Chat/voice | `sendMessage` | agent birth runtime | `createAgentBirthService` | New agent files |
| Landing page | Chat/voice | `sendMessage` | landing-page runtime | `createLandingPageRunner` | Local site |
| Memory | Chat/voice | `sendMessage` | remember handler | memory/timeline stores | Memory item |
| Artifact download | Artifact card | `capabilities.downloadArtifact` | capability IPC | None | Downloads copy |
| Log export | Settings | `logs.exportRedacted` | log IPC | trace/log writers | Open log folder |

## 12. Recommended Next Capability Work

Priority 1:

1. Split main-process integrated flows into smaller runtime modules.
2. Align voice spoken-response threshold documentation and code.
3. Replace static conversation history with real persisted history or hide it.
4. Decide whether to mount or remove `AgentBirthPreview`.

Priority 2:

1. Persist full research reports for restart-safe follow-ups.
2. Add visible progress updates for video generation polling.
3. Add per-memory delete/edit and optional confirmation for inferred memories.
4. Either implement or remove unemitted task events.

Priority 3:

1. Add cross-platform secure key storage if non-macOS support becomes a product goal.
2. Add release signing, hardened runtime, entitlements, and notarization.
3. Add richer route diagnostics and capability health dashboard.

## 13. Verification Commands

Use these commands when validating integrated flow changes:

```bash
npm run audit:capabilities
npm run audit:fixtures
npm run typecheck
npm test
```

Use narrower checks while working:

```bash
npm run test:core
npm run test:desktop
npm run typecheck:core
npm run typecheck:desktop
```

Use runtime verification for UI or provider-adapter work:

```bash
npm run dev
```

Then smoke test setup, chat, research, media, voice, approvals, artifacts, memory, and landing pages through the Electron app.

