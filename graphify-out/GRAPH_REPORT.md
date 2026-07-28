# Graph Report - .  (2026-07-28)

## Corpus Check
- 262 files · ~465,914 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1156 nodes · 2303 edges · 84 communities (72 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 311,330 input · 0 output

## Community Hubs (Navigation)
- Landing Page Generation & Sandbox
- Core Data Services (Approvals/Connectors/Memory/Timeline)
- MiniMax Creative Service & API Client
- Agent Birth & Registry
- Renderer Voice Session Hook
- Electron Main Process Core
- Project Documentation & Setup Guides
- Voice-Driven Approval Resolution
- Renderer Setup Screen
- Renderer Global Type Declarations
- Voice Transcription Service
- Capability Map Dev Tool
- Feature Flags & Tooling Reference
- Core Package Manifest
- Base TypeScript Config
- Renderer-Main Bridge / Capability IDs
- MiniMax TTS Service
- MiniMax Setup IPC & Service
- Voice IPC Controller
- Root Package Scripts
- Chat & Workspace UI Components
- Tavily MCP Client & Secret Redaction
- Fixture Audit Dev Tool
- Avatar Animation & Rendering
- Renderer App Entry & State
- Desktop Build Tooling Dependencies
- Voice IPC & Voice Types
- Observability / Tracing
- Voice Provider Setup & Key Store
- Window Messaging & Panel Management
- Capability Flow Router
- Connector Settings & Status UI
- Desktop Node TS Config
- MiniMax Task Runner
- Response Presentation & Spoken Policy
- Desktop App Runtime Dependencies
- Main Process Service Hydration
- Capability IPC (Artifacts)
- Main Process Task & Agent Event Handling
- Conversation & Agent Switcher UI
- Desktop Web TS Config
- Cross-Module Capability References
- Approval IPC & Modal UI
- App State & Memory Timeline UI
- Refactor Skill & Shared Type Aliases
- Memory Extraction from Conversation
- Voice UI Controls & Captions
- Task Orchestration
- Research Service
- Capability Routing Helpers (Research/Media)
- Agent Birth Task Events
- Renderer App Test Helpers
- Agent Profile Definitions
- Task Drawer UI
- Main Process Setup & Task Error Handling
- Fixture Audit & Media Fixtures
- Tavily Research Connector
- Core TS Config
- macOS App Lifecycle Handling
- Task IPC Controller
- Global Voice Shortcut Registration
- Intent Classification
- Secure Key Store & Command Runner
- Desktop Package Identity
- Desktop Package Scripts
- Tavily Setup Service
- Bubbles Avatar Sprite Sheet
- Voice Affect Detection
- Tavily Status Broadcasting
- Electron Dependency
- jsdom Dependency
- Jest-DOM Testing Library
- React Testing Library
- TypeScript Dependency
- Vitest Dependency
- Audit Shell Script Entry
- Intent Routing Design Notes
- Shared Type Contract Duplication
- Main Process Concentration Rationale
- pnpm Shim Script

## God Nodes (most connected - your core abstractions)
1. `redactSecrets()` - 41 edges
2. `Bubbles Debugging Skill` - 31 edges
3. `routeCapabilityFlow()` - 24 edges
4. `ApprovalRequest` - 23 edges
5. `Bubbles Project README` - 23 edges
6. `ConnectorConfig` - 22 edges
7. `Bubbles Tooling And MCP Skill` - 22 edges
8. `AgentProfile` - 21 edges
9. `MemoryItem` - 21 edges
10. `Bubbles MVP Agent Instructions (AGENTS.md)` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Bubbles Architecture Map` --references--> `AppState`  [EXTRACTED]
  .codex/skills/bubbles-development-workflow/references/architecture-map.md → apps/desktop/src/main/main.ts
- `Bubbles Debugging Skill` --references--> `createMiniMaxTaskRunner()`  [EXTRACTED]
  .codex/skills/bubbles-debugging/SKILL.md → packages/core/src/minimax/minimaxTaskRunner.ts
- `Electron Renderer Sandbox Disabled` --semantically_similar_to--> `MVP Local-Only Packaging Decision`  [INFERRED] [semantically similar]
  docs/Technical.md → apps/desktop/electron-builder.yml
- `ApprovalVoiceIpcControllerOptions` --references--> `ApprovalRequest`  [EXTRACTED]
  apps/desktop/src/main/ipc/approvalVoiceIpc.ts → packages/core/src/shared/types.ts
- `SetupScreenProps` --references--> `SetupStatus`  [EXTRACTED]
  apps/desktop/src/renderer/screens/SetupScreen.tsx → packages/core/src/minimax/setupService.ts

## Import Cycles
- 3-file cycle: `apps/desktop/src/renderer/App.tsx -> apps/desktop/src/renderer/components/AssistantPanel.tsx -> apps/desktop/src/renderer/components/ChatSurface.tsx -> apps/desktop/src/renderer/App.tsx`

## Hyperedges (group relationships)
- **Bubbles Three-Layer Architecture** — packages_core_src, apps_desktop_src_main, apps_desktop_src_renderer [EXTRACTED 1.00]
- **Bubbles Capability Routing Flow** — packages_core_src_createflowrouter, packages_core_src_runcreativecapability, packages_core_src_runtavilyresearch, packages_core_src_runapprovedlandingpageaction [EXTRACTED 1.00]
- **Bubbles Provider Setup Service Pattern** — packages_core_src_setupservice, packages_core_src_voice_voicesetupservice, packages_core_src_connectors_tavilysetupservice [INFERRED 0.85]
- **Required Provider Key Setup** — docs_setup_guide_minimax_token_plan_key, docs_setup_guide_tavily_remote_mcp, docs_setup_guide_gemini_stt, docs_setup_guide_openai_stt_fallback [INFERRED 0.85]
- **Production Readiness Test Documentation** — docs_productiontestchecklist_document, docs_codex_production_test_prompt_document, docs_frd_release_readiness_checklist [INFERRED 0.85]
- **Filesystem-Backed Agent Profile Documentation Template** — agents_qa_agent_skills_qa_agent, agents_reaserch_agent_agent_reaserch_agent, agents_reaserch_agent_skills_reaserch_agent [INFERRED 0.85]

## Communities (84 total, 12 thin omitted)

### Community 0 - "Landing Page Generation & Sandbox"
Cohesion: 0.07
Nodes (49): copyManagedLandingPageProject(), CopyManagedLandingPageProjectInput, CopyManagedLandingPageProjectResult, isManagedLandingPageDir(), readLandingPageProjectFiles(), resolveManagedOutputDir(), sanitizeLandingPageProjectName(), makeSourceProject() (+41 more)

### Community 1 - "Core Data Services (Approvals/Connectors/Memory/Timeline)"
Cohesion: 0.06
Nodes (33): defaultHealth(), registerConnectorIpc(), RegisterConnectorIpcOptions, handles, ApprovalServiceOptions, CreateApprovalInput, redactPreview(), redactValue() (+25 more)

### Community 2 - "MiniMax Creative Service & API Client"
Cohesion: 0.09
Nodes (43): artifactFor(), assertMiniMaxBaseRespOk(), createCreativeService(), CreativeKind, CreativeRequest, CreativeResult, CreativeServiceOptions, FetchLike (+35 more)

### Community 3 - "Agent Birth & Registry"
Cohesion: 0.08
Nodes (30): AgentBirthPreview(), AgentBirthPreviewProps, AgentBirthService, AgentBirthServiceOptions, createAgentBirthService(), createDefaultAgentMarkdown(), createDefaultSkillsMarkdown(), createRecommendedAgentBirthDraft() (+22 more)

### Community 4 - "Renderer Voice Session Hook"
Cohesion: 0.08
Nodes (20): audioBlobToTranscriptionPayload(), audioBlobToWavDataUrl(), blobToDataUrl(), canUseMicrophoneCapture(), createRendererVoiceState(), createSpokenArrivalKey(), isNewerThanBaseline(), isProgressVoiceReply() (+12 more)

### Community 5 - "Electron Main Process Core"
Cohesion: 0.09
Nodes (27): registerTavilySetupIpc(), AvatarState, compactBounds, createWindow(), handleMoveAppToTrash(), installApplicationMenu(), LandingPageRunResult, loadRenderer() (+19 more)

### Community 6 - "Project Documentation & Setup Guides"
Cohesion: 0.15
Nodes (33): QA Agent Skills Document, Reaserch Agent Profile Document, Reaserch Agent Skills Document, Bubbles Electron Builder Config, MVP Local-Only Packaging Decision, Desktop Renderer Entry HTML, Bubbles Production Test Codex Agent Prompt, Bubbles MVP Functional Requirements Document (+25 more)

### Community 7 - "Voice-Driven Approval Resolution"
Cohesion: 0.10
Nodes (21): ApprovalVoiceIpcControllerOptions, ApprovalVoiceResolver, IpcHandler, IpcMainLike, parseResolveApprovalVoiceInput(), registerApprovalVoiceIpc(), ResolveApprovalVoiceInput, ResolveVoiceApprovalInput (+13 more)

### Community 8 - "Renderer Setup Screen"
Cohesion: 0.12
Nodes (22): formatSetupError(), getHeadline(), getShouldShowTokenForm(), isTransientSetupError(), isWorking(), SetupActionFooterProps, SetupScreen(), SetupScreenProps (+14 more)

### Community 9 - "Renderer Global Type Declarations"
Cohesion: 0.08
Nodes (24): AffectTag, AgentBirthDraft, AgentProfile, AppLifecycleResult, ApprovalRequest, ApprovalVoiceDecision, ApprovalVoiceResolution, AvatarState (+16 more)

### Community 10 - "Voice Transcription Service"
Cohesion: 0.13
Nodes (21): classifyFailure(), classifyStatus(), createVoiceTranscriptionService(), decodeDataUrl(), extensionForMimeType(), extractDataUrlBase64(), extractGeminiText(), FetchLike (+13 more)

### Community 11 - "Capability Map Dev Tool"
Cohesion: 0.09
Nodes (19): agents, connectorIds, connectorRegistry, envFlags, ipcHandlers, mainText, packageJson, preloadInvokes (+11 more)

### Community 12 - "Feature Flags & Tooling Reference"
Cohesion: 0.15
Nodes (23): Bubbles MVP Agent Instructions (AGENTS.md), BUBBLES_CODING_LANDING_PAGE, BUBBLES_CREATIVE_IMAGE, BUBBLES_CREATIVE_MUSIC, BUBBLES_VOICE_APPROVALS_ENABLED, BUBBLES_VOICE_ENABLED, Bubbles Runtime Verification OpenAI Agent Interface, Runtime Verification Checklist (+15 more)

### Community 13 - "Core Package Manifest"
Cohesion: 0.09
Nodes (21): dependencies, sql.js, @types/sql.js, devDependencies, @types/node, typescript, vitest, sql.js (+13 more)

### Community 14 - "Base TypeScript Config"
Cohesion: 0.10
Nodes (19): DOM, DOM.Iterable, ES2022, compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames (+11 more)

### Community 15 - "Renderer-Main Bridge / Capability IDs"
Cohesion: 0.13
Nodes (19): preload.ts, BubblesAppState, agent.create capability, coding.landing_page capability, creative.image capability, creative.minimax capability, creative.music capability, research.web capability (+11 more)

### Community 16 - "MiniMax TTS Service"
Cohesion: 0.11
Nodes (9): createTtsService(), FetchLike, MiniMaxTtsInput, MiniMaxTtsResult, MiniMaxTtsServiceOptions, ResponseLike, tempDirs, TtsResult (+1 more)

### Community 17 - "MiniMax Setup IPC & Service"
Cohesion: 0.16
Nodes (14): createJsonSetupStatusStore(), createProcessRunner(), registerSetupIpc(), RegisterSetupIpcOptions, VerificationResult, createMiniMaxSetupService(), MiniMaxSetupService, MiniMaxSetupServiceOptions (+6 more)

### Community 18 - "Voice IPC Controller"
Cohesion: 0.15
Nodes (15): BargeInInput, createVoiceIpcController(), IpcHandler, IpcMainLike, parseBargeInInput(), parseSpeakInput(), parseSubmitTranscriptInput(), parseTranscribeAudioInput() (+7 more)

### Community 19 - "Root Package Scripts"
Cohesion: 0.11
Nodes (17): name, packageManager, private, scripts, audit:capabilities, audit:fixtures, build, dev (+9 more)

### Community 20 - "Chat & Workspace UI Components"
Cohesion: 0.20
Nodes (12): AvatarState, ChatMessage, AssistantPanel(), AssistantPanelProps, ArtifactCard(), ChatSurface(), ChatSurfaceProps, toArtifactUrl() (+4 more)

### Community 21 - "Tavily MCP Client & Secret Redaction"
Cohesion: 0.20
Nodes (13): redactLaunchConfig(), createTavilyRemoteMcpClient(), FetchLike, friendlyTavilyError(), getHeader(), initializeSession(), parseMcpBody(), postMcp() (+5 more)

### Community 22 - "Fixture Audit Dev Tool"
Cohesion: 0.23
Nodes (15): args, collectSignals(), countEventEmits(), countToolReferences(), ignoredDirs, parseAgentTools(), parseTaskEvents(), printDeclaredTools() (+7 more)

### Community 23 - "Avatar Animation & Rendering"
Cohesion: 0.23
Nodes (12): bubblesSpriteMetadata, getAvatarAnimation(), getAvatarPlayback(), normalizeAvatarState(), SpriteAnimation, SpriteMetadata, validateSpriteMetadata(), AvatarStage() (+4 more)

### Community 24 - "Renderer App Entry & State"
Cohesion: 0.22
Nodes (13): App(), floatingBubbleText(), initialAppState, initialMessages, isNewerThanBaseline(), isProgressBubbleMessage(), latestBubbleReplyCandidateAfter(), maxMessageId() (+5 more)

### Community 25 - "Desktop Build Tooling Dependencies"
Cohesion: 0.13
Nodes (15): devDependencies, electron-builder, electron-vite, @types/node, @types/react, @types/react-dom, vite, @vitejs/plugin-react (+7 more)

### Community 26 - "Voice IPC & Voice Types"
Cohesion: 0.16
Nodes (12): SubmitTranscriptInput, VoiceIpcControllerOptions, VoiceIpcResult, TranscriptionProviderError, AgentBirthVoiceRequest, CapabilityOutput, McpToolInvocation, VoiceEvent (+4 more)

### Community 27 - "Observability / Tracing"
Cohesion: 0.25
Nodes (13): createId(), createTrace(), createTraceEvent(), CreateTraceEventInput, CreateTraceInput, logEvent(), sanitizeField(), sanitizeFields() (+5 more)

### Community 28 - "Voice Provider Setup & Key Store"
Cohesion: 0.23
Nodes (10): registerVoiceSetupIpc(), RegisterVoiceSetupIpcOptions, SecureKeyStore, createVoiceSetupService(), createHarness(), VoiceProviderSetupStatus, VoiceSetupKeyStore, VoiceSetupService (+2 more)

### Community 29 - "Window Messaging & Panel Management"
Cohesion: 0.24
Nodes (8): SendableWebContents, SendableWindow, sendToWindow(), broadcastVoiceSetupStatus(), createPanelWindow(), keepAvatarAbovePanel(), presentApprovalPopupWindow(), registerWindowIpc()

### Community 30 - "Capability Flow Router"
Cohesion: 0.19
Nodes (9): ChatMessage, TavilySearchResult, CreateApproval, createFlowRouter(), FlowRouterInput, FlowRouterOptions, FlowRouterResult, ResearchReport (+1 more)

### Community 31 - "Connector Settings & Status UI"
Cohesion: 0.22
Nodes (9): IntegrationStatusBar(), IntegrationStatusBarProps, StatusBadgeProps, voiceStatusText(), connectorHelpText(), ConnectorSettings(), ConnectorSettingsProps, tavilyUpdate() (+1 more)

### Community 32 - "Desktop Node TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, composite, module, moduleResolution, types, extends, include, node (+5 more)

### Community 33 - "MiniMax Task Runner"
Cohesion: 0.18
Nodes (9): appendTaskLog(), createErrorEvent(), createMiniMaxTaskRunner(), FetchLike, MiniMaxTaskRunner, MiniMaxTaskRunnerOptions, ResponseLike, tempDirs (+1 more)

### Community 34 - "Response Presentation & Spoken Policy"
Cohesion: 0.25
Nodes (10): PresentedResponse, presentResponse(), PresentResponseInput, SourceReference, normalizeWhitespace(), PreparedSpokenResponse, prepareSpokenResponse(), PrepareSpokenResponseInput (+2 more)

### Community 35 - "Desktop App Runtime Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @bubbles/core, lucide-react, pixi.js, react, react-dom, sql.js, sql.js (+5 more)

### Community 36 - "Main Process Service Hydration"
Cohesion: 0.21
Nodes (13): registerApprovalIpc(), createApprovalVoiceIpcController(), checkConnectorHealth(), hydrateApprovalState(), hydrateConnectorState(), hydrateMemoryState(), initializeSafetyIpc(), createApprovalService() (+5 more)

### Community 37 - "Capability IPC (Artifacts)"
Cohesion: 0.23
Nodes (9): downloadFileName(), parseArtifactTarget(), parseArtifactTitle(), registerCapabilityIpc(), RegisterCapabilityIpcOptions, resolveLocalArtifact(), sanitizeFileName(), mocks (+1 more)

### Community 38 - "Main Process Task & Agent Event Handling"
Cohesion: 0.22
Nodes (13): agentDraftFromApprovalPreview(), appendCapabilityTaskEvent(), appendTraceEvent(), broadcastAppState(), createVoiceTraceFields(), handleApprovalResolved(), handlePendingAgentSwitch(), handleTaskStarted() (+5 more)

### Community 39 - "Conversation & Agent Switcher UI"
Cohesion: 0.27
Nodes (7): AgentSwitcher(), AgentSwitcherProps, ConversationHistory(), conversations, ConversationRail(), ConversationRailProps, AgentProfile

### Community 40 - "Desktop Web TS Config"
Cohesion: 0.15
Nodes (12): compilerOptions, types, extends, include, ../../tsconfig.base.json, vitest/globals, src/avatar/**/*.ts, src/renderer/**/*.ts (+4 more)

### Community 41 - "Cross-Module Capability References"
Cohesion: 0.17
Nodes (12): global.d.ts, Bubbles Debugging OpenAI Agent Interface, Bubbles Debugging Skill, packages/core/src/connectors (Tavily connectors), packages/core/src/minimax, generateMiniMaxText, preflightMiniMaxApi, runApprovedLandingPageAction (+4 more)

### Community 42 - "Approval IPC & Modal UI"
Cohesion: 0.27
Nodes (7): RegisterApprovalIpcOptions, mocks, ApprovalModal(), ApprovalModalProps, formatPreview(), ApprovalService, ApprovalRequest

### Community 43 - "App State & Memory Timeline UI"
Cohesion: 0.36
Nodes (9): AppState, BubblesAppState, connectorFallbackText(), DegradedStateList(), WorkspaceStatusRailProps, MemoryTimeline(), MemoryTimelineProps, MemoryItem (+1 more)

### Community 44 - "Refactor Skill & Shared Type Aliases"
Cohesion: 0.18
Nodes (11): apps/desktop/src/main (Electron main), apps/desktop/src/renderer (React renderer), Bubbles Refactor OpenAI Agent Interface, Bubbles Refactor Skill, ConnectorConfig, MemoryItem, SetupStatus, TaskPacket (+3 more)

### Community 45 - "Memory Extraction from Conversation"
Cohesion: 0.22
Nodes (7): extractMemoriesFromMessage(), handleRememberCommand(), createMemoryExtractor(), ExtractMemoryOptions, GenerateJson, MemoryExtractorOptions, parseExplicitRememberCommand()

### Community 46 - "Voice UI Controls & Captions"
Cohesion: 0.29
Nodes (6): CaptionBar(), CaptionBarProps, statusText(), VoiceControls(), VoiceControlsProps, VoiceSessionState

### Community 47 - "Task Orchestration"
Cohesion: 0.31
Nodes (6): mapTaskEventToAvatarState(), TaskOrchestrator, TaskRunner, AvatarState, buildTaskPacket(), BuildTaskPacketOptions

### Community 48 - "Research Service"
Cohesion: 0.25
Nodes (6): isReadResearchPrompt(), isResearchFollowUp(), isResearchPrompt(), normalizeReport(), readyVoiceText(), ResearchServiceOptions

### Community 49 - "Capability Routing Helpers (Research/Media)"
Cohesion: 0.24
Nodes (10): isLandingPageRevisionPrompt(), mediaKindForTask(), mediaRunningStatus(), mediaWorkingMessage(), persistResearchReport(), rememberLandingPageAction(), routeCapabilityFlow(), runTavilyResearch() (+2 more)

### Community 50 - "Agent Birth Task Events"
Cohesion: 0.33
Nodes (8): agentBirthDraftTimeoutMs(), createAgentBirthApprovalFromRequest(), AgentBirthDraftingTaskEventOptions, AgentBirthTaskEventOptions, createAgentBirthDraftingTaskEvents(), createAgentBirthTaskEvents(), createTaskEvent(), TaskEventType

### Community 51 - "Renderer App Test Helpers"
Cohesion: 0.24
Nodes (4): createPanelBubbles(), createSetupApi(), createSetupStatus(), SendMessageResult

### Community 52 - "Agent Profile Definitions"
Cohesion: 0.36
Nodes (9): General Assistant Agent, General Assistant Skills, ME A Debug Agent, ME A Debug Agent Profile, ME A Debug Agent Operating Notes, QA Agent Profile, QA Agent, AgentProfile (+1 more)

### Community 53 - "Task Drawer UI"
Cohesion: 0.36
Nodes (6): RegisterTaskIpcOptions, formatEventPayload(), stringPayload(), TaskDrawer(), TaskDrawerProps, TaskEvent

### Community 54 - "Main Process Setup & Task Error Handling"
Cohesion: 0.31
Nodes (9): broadcastSetupStatus(), categorizeSetupFailure(), formatTaskError(), formatTaskMessage(), handleTaskEvent(), isMiniMaxHealthFailure(), persistFinalTaskEvent(), preflightMiniMaxApi() (+1 more)

### Community 55 - "Fixture Audit & Media Fixtures"
Cohesion: 0.33
Nodes (9): BUBBLES_MINIMAX_MEDIA_FIXTURE, Bubbles Fixture Audit OpenAI Agent Interface, Current Fixture-Like Baseline, Bubbles Fixture Audit Skill, Avatar drop visual-only feedback, Static conversation history, Landing-page fixed template, TaskEvent (+1 more)

### Community 56 - "Tavily Research Connector"
Cohesion: 0.36
Nodes (6): createTavilyResearchConnector(), normalizeExtractedContent(), normalizeTavilyResults(), parseMcpResult(), TavilyResearchConnectorOptions, TavilyResearchResponse

### Community 57 - "Core TS Config"
Cohesion: 0.22
Nodes (8): compilerOptions, types, extends, include, node, ../../tsconfig.base.json, vitest/globals, src/**/*.ts

### Community 58 - "macOS App Lifecycle Handling"
Cohesion: 0.46
Nodes (6): AppLifecycleResult, MoveMacAppToTrashInput, movePackagedMacAppToTrash(), ResolvedMacAppBundle, ResolveMacAppBundleInput, resolvePackagedMacAppBundlePath()

### Community 59 - "Task IPC Controller"
Cohesion: 0.29
Nodes (5): createTaskError(), registerTaskIpc(), runPreflight(), TaskIpcController, TaskPreflightResult

### Community 60 - "Global Voice Shortcut Registration"
Cohesion: 0.39
Nodes (5): registerVoiceShortcut(), RegisterVoiceShortcutOptions, ShortcutRegistrar, ShortcutWindow, unregisterVoiceShortcut()

### Community 61 - "Intent Classification"
Cohesion: 0.43
Nodes (5): classifyIntent(), intent(), IntentClassification, TaskType, IntentClassificationV2

### Community 62 - "Secure Key Store & Command Runner"
Cohesion: 0.43
Nodes (4): createSecureKeyStore(), SecureKeyStoreOptions, CommandResult, CommandRunner

### Community 63 - "Desktop Package Identity"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 64 - "Desktop Package Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, package:mac, test, typecheck

### Community 65 - "Tavily Setup Service"
Cohesion: 0.47
Nodes (4): TavilyMcpClientLike, createTavilySetupService(), TavilySetupServiceOptions, TavilySetupState

### Community 66 - "Bubbles Avatar Sprite Sheet"
Cohesion: 0.60
Nodes (5): Bubbles Character Design (robot mascot, blue/yellow astronaut-style suit), Eye Expression Frames (open, blinking/closed, winking, sleepy/eyes-closed) across poses, Idle Pose Row Set (arms-down standing variants with differing eye expressions), Bubbles MVP Avatar Sprite Sheet, Tablet/Device-Holding Pose Row Set (avatar holding a dark rectangular device)

### Community 68 - "Tavily Status Broadcasting"
Cohesion: 0.67
Nodes (3): broadcastTavilySetupStatus(), handleTavilySetupStatus(), syncTavilyConnectorStatus()

## Knowledge Gaps
- **330 isolated node(s):** `run-audit.sh script`, `name`, `version`, `private`, `main` (+325 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Bubbles Tooling And MCP Skill` connect `Feature Flags & Tooling Reference` to `Tavily Setup Service`, `Electron Main Process Core`, `Renderer Setup Screen`, `Renderer-Main Bridge / Capability IDs`, `Tavily MCP Client & Secret Redaction`, `Fixture Audit & Media Fixtures`, `Tavily Research Connector`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `Bubbles Debugging Skill` connect `Cross-Module Capability References` to `MiniMax Task Runner`, `Feature Flags & Tooling Reference`, `Refactor Skill & Shared Type Aliases`, `Renderer-Main Bridge / Capability IDs`, `MiniMax TTS Service`, `MiniMax Setup IPC & Service`, `Voice IPC Controller`, `Renderer App Test Helpers`, `Task IPC Controller`, `Voice Provider Setup & Key Store`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `redactSecrets()` connect `Tavily MCP Client & Secret Redaction` to `Landing Page Generation & Sandbox`, `Core Data Services (Approvals/Connectors/Memory/Timeline)`, `Tavily Setup Service`, `MiniMax Creative Service & API Client`, `MiniMax Task Runner`, `Electron Main Process Core`, `Voice Transcription Service`, `Memory Extraction from Conversation`, `MiniMax TTS Service`, `MiniMax Setup IPC & Service`, `Agent Birth Task Events`, `Research Service`, `Tavily Research Connector`, `Observability / Tracing`, `Voice Provider Setup & Key Store`, `Secure Key Store & Command Runner`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `run-audit.sh script`, `name`, `version` to the rest of the system?**
  _330 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Landing Page Generation & Sandbox` be split into smaller, more focused modules?**
  _Cohesion score 0.06641604010025062 - nodes in this community are weakly interconnected._
- **Should `Core Data Services (Approvals/Connectors/Memory/Timeline)` be split into smaller, more focused modules?**
  _Cohesion score 0.06352941176470588 - nodes in this community are weakly interconnected._
- **Should `MiniMax Creative Service & API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.08843537414965986 - nodes in this community are weakly interconnected._