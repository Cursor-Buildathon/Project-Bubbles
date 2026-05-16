# Bubbles MVP — Full Codebase Analysis

## 1. Project Overview

Bubbles is a **macOS desktop AI assistant** built as an Electron app with a floating animated avatar. Users interact via text chat or voice, and Bubbles delegates work to specialized AI agents backed by the **MiniMax** AI platform (via its `mmx` CLI). The app can read/send email, manage calendars, perform web research, generate images/music, create landing pages, and spawn new custom agents — all gated by a human-in-the-loop approval system.

**Key characteristics:**

- Two-window desktop UX: a small always-on-top animated avatar + a full workspace panel
- Multi-agent architecture with filesystem-backed agent profiles
- Hybrid connector system supporting real APIs and fixture/demo modes
- Approval-gated sensitive actions with optional voice-based approval
- SQLite persistence for memory, timeline, approvals, and connectors
- Comprehensive secret redaction across all logs and stored data

---

## 2. Workspace Structure

```
bubbles-MVP/                         pnpm monorepo root (corepack pnpm@9.15.4)
├── packages/core/                   @bubbles/core — business logic, zero Electron deps
├── apps/desktop/                    @bubbles/desktop — Electron + React + PixiJS
├── agents/                          On-disk agent profiles (JSON + skills markdown)
│   ├── general-assistant/
│   ├── coding-agent/
│   ├── research-agent/
│   ├── email-calendar-assistant/
│   ├── creative-minimax-helper/
│   └── qa-agent-001/
├── tools/mcp/                       MCP fixture scripts
├── docs/                            Design docs, test plans, demo scripts
├── output/                          Generated sprite assets for the avatar
├── .codex/skills/                   Codex skill bundles (debugging, refactor, tooling)
├── AGENTS.md                        Repository-level agent instructions
├── package.json                     Root workspace scripts
├── pnpm-workspace.yaml              Workspace member globs
└── tsconfig.base.json               Shared TypeScript baseline
```

### Workspace Configuration

**`pnpm-workspace.yaml`** defines two member groups:
```yaml
packages:
  - apps/*
  - packages/*
```

**Root `package.json`** delegates all commands through `corepack pnpm`:
- `dev` / `build` — filtered to `@bubbles/desktop`
- `test` / `typecheck` — recursive across all packages
- `test:core` / `test:desktop` — package-specific test runs
- `mcp:search-fixture` — runs the MCP fixture helper

**`tsconfig.base.json`** — shared baseline: ES2022 target, strict mode, ESNext modules, Bundler resolution, React JSX.

---

## 3. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Electron Main Process                         │
│                                                                      │
│  main.ts  ─── AppState (single source of truth)                      │
│    │                                                                 │
│    ├── setupIpc ──────── MiniMax setup flow                          │
│    ├── taskIpc ───────── CLI bridge + task orchestration              │
│    ├── approvalIpc ───── Approval CRUD                               │
│    ├── approvalVoiceIpc  Voice-based approval resolution             │
│    ├── voiceIpc ──────── Voice session lifecycle + TTS               │
│    ├── connectorIpc ──── Connector CRUD + health checks              │
│    ├── capabilityIpc ─── Artifact opening                            │
│    └── windowMessaging ─ Safe IPC broadcast to windows               │
│                                                                      │
│  Services from @bubbles/core:                                        │
│    agentRegistry, approvalService, connectorRegistry,                │
│    memoryStore, timelineStore, flowRouter, cliBridge,                │
│    mcpClient, secureKeyStore, minimax services                       │
└──────────────┬───────────────────────────────────────────────────────┘
               │ contextBridge (preload.ts)
               │ window.bubbles API
┌──────────────▼───────────────────────────────────────────────────────┐
│                        React Renderer                                │
│                                                                      │
│  App.tsx ─── windowRole: 'avatar' | 'panel'                         │
│    │                                                                 │
│    ├── FloatingAvatarWindow ── AvatarStage (PixiJS sprites)          │
│    │                                                                 │
│    └── AssistantPanel                                                │
│          ├── WorkspaceHeader                                         │
│          ├── ConversationRail ── AgentSwitcher, AgentBirthPreview    │
│          ├── ChatSurface ─────── Message list, artifacts, citations  │
│          ├── VoiceControls                                           │
│          ├── TaskDrawer                                              │
│          ├── ApprovalModal                                           │
│          └── WorkspaceStatusRail                                     │
│                ├── SetupScreen                                       │
│                ├── ConnectorSettings                                 │
│                └── MemoryTimeline                                    │
└──────────────────────────────────────────────────────────────────────┘

External Dependencies:
  ├── mmx CLI (MiniMax AI) ── text chat, image/music generation
  ├── MiniMax REST API ────── JSON generation, key verification
  ├── Google Workspace MCP ── Gmail, Calendar (OAuth + HTTP JSON-RPC)
  └── macOS Keychain ──────── Secure API key storage
```

---

## 4. packages/core — Business Logic Layer

**Package:** `@bubbles/core` (`packages/core/`)
**Entry:** `src/index.ts` — flat barrel re-exporting all modules
**Dependencies:** `sql.js` (WASM SQLite)
**Dev tooling:** Vitest, TypeScript

All business logic is Electron-free. Every module exports factory functions (`createXxx`) with injected dependencies for testability.

### 4.1 Shared Types (`src/shared/types.ts`)

Central DTOs used across the entire app:

| Type | Purpose |
|------|---------|
| `AvatarState` | 9 animation states: idle, listening, thinking, working, waiting_approval, confused, concerned, celebrating, sleeping |
| `TaskType` | 12 task categories: general.plan, research.web, coding.project, coding.landing_page, email.read/reply, calendar.read/update, agent.create, creative.image/music/minimax |
| `TaskPacket` | Structured payload sent to the MiniMax CLI with user text, agent context, memory, skills, tools, and output preferences |
| `CliEvent` | Typed event stream from CLI execution: task.received, task.status, task.partial_output, tool.requested, approval.required/accepted/denied, task.result/error/cancelled |
| `ApprovalRequest` | Approval with action type, risk level, preview, and status lifecycle |
| `MemoryItem` | Persisted memory with type (user_preference, project_context, task_summary, decision, etc.), tags, and importance (1-5) |
| `TimelineEvent` | Append-only timeline entry for agent/task/memory/approval lifecycle events |
| `AgentProfile` | Agent identity: name, role, badge, voice style, allowed tools, memory/safety rules, response style, skills path |
| `ConnectorConfig` | Connector configuration with type, mode (real/fixture), auth/health status, launch config, and approval requirements |
| `ArtifactMetadata` | Generated artifact reference (image, audio, or site) |

### 4.2 Agents (`src/agents/`)

**`agentRegistry.ts`** — Filesystem-backed agent registry:
- Reads `agents/<id>/agent.json` + `skills.md` from the project root
- Operations: `list`, `load`, `create`, `activate`, `archive`, `getActive`, `initialize`
- In-memory active agent ID, defaults to `general-assistant`
- `create()` writes both `agent.json` and `skills.md` to disk

**`agentSchema.ts`** — Validates `AgentProfile` objects:
- Enforces required fields and non-empty strings
- Validates `skillsPath` format (`agents/<id>/skills.md`)
- Rejects visual customization fields (product constraint)

**`agentBirthService.ts`** — AI-powered agent creation:
- Accepts natural language description of desired agent
- Uses injected `generateJson` (wired to MiniMax API) to draft profile
- Returns `AgentBirthDraft` with profile + skills markdown for approval

**Pre-built agents:**

| Agent ID | Role |
|----------|------|
| `general-assistant` | Default desktop assistant ("Bubbles") |
| `coding-agent` | Code-focused tasks |
| `research-agent` | Web research |
| `email-calendar-assistant` | Email and calendar operations |
| `creative-minimax-helper` | MiniMax creative media |
| `qa-agent-001` | Quality assurance |

### 4.3 Orchestration (`src/orchestration/`)

**`intentClassifier.ts`** — Classifies user text into task types:
- Regex/keyword heuristics map natural language to `TaskType`
- Returns `IntentClassification` with `taskType`, `suggestedAgentId`, and `confidence`

**`flowRouter.ts`** — Routes intents to capability-specific flows:
- `research.web` → web search connector → cited results
- `email.read` → email connector → latest message
- `email.reply` → draft email → create approval → wait
- `calendar.read` → calendar connector → tomorrow's events
- `calendar.update` → draft event → create approval → wait
- `creative.image` / `creative.music` → MiniMax media generation
- `coding.landing_page` → create shell_command approval → sandboxed build
- `agent.create` → redirect to Agent Birth UI
- `creative.minimax` → MiniMax routing message
- Unmatched intents → `handled: false` → falls through to CLI task path

**`orchestrator.ts`** — Wraps `CliBridge` for general CLI tasks:
- Builds `TaskPacket` from user text + agent context + memory
- Maps `CliEvent` types to `AvatarState` for UI feedback

**`responsePresenter.ts`** — Formats task results for chat and voice output.

### 4.4 CLI Bridge (`src/cli/`)

**`cliBridge.ts`** — Spawns and manages MiniMax CLI processes:
- Default command: `mmx text chat --message "<task-packet-json>"`
- Parses stdout/stderr as JSON event streams via `cliEventParser`
- 120-second stall timeout with auto-SIGTERM
- Task cancellation via SIGTERM
- Preflight health check before spawning
- Redacted task logging to `<logDir>/<taskId>.log`

**`cliEventParser.ts`** — Parses MiniMax CLI output:
- JSON-line parsing into typed `CliEvent` objects
- `extractMiniMaxResponseText` for chat-completion-shaped JSON
- `createEvent` helper for synthetic events

**`taskPacketBuilder.ts`** — Assembles `TaskPacket` structs:
- Loads agent profile and skills from filesystem
- Includes memory context, allowed tools, approval policy
- Sets output preferences for non-technical spoken summaries

### 4.5 Connectors (`src/connectors/`)

**`connectorRegistry.ts`** — SQLite-backed connector configuration:
- CRUD for `ConnectorConfig` with auto-seeding of defaults (web-search, local-files, email, calendar)
- Redacts launch config args/env and error messages on persist

**`mcpClient.ts`** — Generic MCP (Model Context Protocol) client:
- Supports both **subprocess** transport (command + args + JSON-RPC on argv) and **HTTP** transport (POST with Bearer token)
- Used by all connectors for real-mode API calls

**`emailConnector.ts`** — Email integration:
- **Fixture mode:** returns sample email data
- **Real mode:** MCP calls for `latest`, `createDraft`, `sendDraft`
- Gmail MCP config with OAuth scopes: `gmail.readonly`, `gmail.compose`, `gmail.send`

**`calendarConnector.ts`** — Calendar integration:
- **Fixture mode:** returns sample calendar events
- **Real mode:** MCP calls for `listTomorrow`, `suggestTime`, `createEvent`
- Google Calendar MCP config with `calendar.events.owned` + read/freebusy scopes

**`webSearchConnector.ts`** — Web search integration:
- **Fixture mode:** returns canned cited results
- **Real mode:** MCP `search` method with query and maxResults
- Optional MiniMax search fallback when MCP is unavailable

**`localFilesConnector.ts`** — Local file access:
- Constrained by `launchConfig.approvedRoots`
- `prepareWrite` returns approval payloads for `file_write` actions

**`googleWorkspaceScopes.ts`** — Exports `GOOGLE_GMAIL_MCP_CONFIG` and `GOOGLE_CALENDAR_MCP_CONFIG` with HTTP URLs, OAuth scopes, and tool name mappings.

### 4.6 Memory (`src/memory/`)

**`memoryStore.ts`** — SQLite-backed memory persistence:
- `memories` table with id, type, content, source task, agent, tags, importance, timestamps
- Content is auto-redacted via `redactSecrets` on write
- Startup migration pass redacts any unredacted existing rows
- Operations: `create`, `list`, `query` (with filtering by type/agent/tags/limit), `deleteAll`

**`memoryExtractor.ts`** — AI-powered memory extraction:
- Uses MiniMax JSON generation to extract `MemoryItem` candidates from user messages
- `parseExplicitRememberCommand` handles `remember ...` directives

### 4.7 Timeline (`src/timeline/`)

**`timelineStore.ts`** — SQLite-backed append-only event log:
- `timeline_events` table with type, title, summary, associations (task/agent/memory), metadata
- Summary and metadata are redacted on write
- Operations: `append`, `list` (with limit)

### 4.8 Approvals (`src/approvals/`)

**`approvalService.ts`** — SQLite-backed approval management:
- Creates approvals with auto-assigned risk level and redacted preview
- Status lifecycle: `pending` → `approved` / `denied` / `cancelled`
- On resolution: appends timeline event + creates `approval_history` memory item
- Operations: `create`, `list`, `resolve`, `requireApproved`

**`riskClassifier.ts`** — Maps action types to risk levels:

| Action Type | Risk |
|------------|------|
| `send_email` | high |
| `calendar_update` | medium |
| `file_write` | medium |
| `shell_command` | high |
| `cli_install` | high |
| `agent_file_create` | medium |
| `external_data_send` | high |

**`voiceApprovalResolver.ts`** — Resolves approvals via voice commands:
- Delegates to `approvalVoiceDecision` for phrase classification
- Can be disabled via configuration

### 4.9 MiniMax Integration (`src/minimax/`)

**`minimaxApiClient.ts`** — Direct MiniMax REST API client:
- `verifyMiniMaxApiKey` — validates API key
- `generateMiniMaxJson` — chat completions with JSON-object response format
- Used for agent birth, memory extraction, and key verification

**`minimaxCliManager.ts`** — Manages the `mmx` CLI binary:
- Detect, install (`npm install --global --prefix`), authenticate, verify
- Returns `VerificationResult` with CLI health status

**`setupService.ts`** — Multi-step MiniMax setup state machine:
- Stages: general API key → token plan key → CLI install → authenticate → verify
- Exposes `SetupStatus` with per-component health (general API, token plan, CLI)
- `sanitizeStatus` redacts sensitive error details

**`creativeService.ts`** — Image and music generation:
- Runs `mmx image generate` / `mmx music generate`
- Supports fixture mode with deterministic SVG/audio output
- Returns artifact metadata for chat display

**`ttsService.ts`** — Text-to-speech service abstraction.

### 4.10 Voice (`src/voice/`)

**`voiceTypes.ts`** — Typed voice system:
- `VoiceEvent` union: session_started/stopped, partial/final transcript, barge_in, error
- `VoiceSessionState`: enabled, mode (push-to-talk), provider, status, active turn, caption/partial text
- `createInitialVoiceSessionState` factory

**`affectDetector.ts`** — Heuristic emotional affect detection from transcript text (happy, frustrated, urgent, confused).

**`spokenResponsePolicy.ts`** — Decides whether to speak a response aloud based on context and content.

**`approvalVoiceDecision.ts`** — Phrase-based classification of voice input into approve/deny/cancel actions.

### 4.11 Security (`src/security/`)

**`redactSecrets.ts`** — Regex-based secret redaction:
- Strips API keys (`--api-key ...`), Bearer tokens, `sk-` prefixed keys
- Applied to all logs, stored content, error messages, CLI output, MCP payloads

**`secureKeyStore.ts`** — macOS Keychain integration:
- Uses `/usr/bin/security` CLI for secure storage
- Separate keychain services for General API key and Token Plan key
- All errors pass through `redactSecrets`

### 4.12 Other Modules

**`observability/trace.ts`** — Structured trace event creation with redacted fields for observability logging to `observability.ndjson`.

**`coding/landingPageRunner.ts`** — Sandboxed landing page generation:
- Generates static site files in artifact directory
- Runs accessibility checks and Vite builds
- `findAvailablePort` and `createStaticSiteServer` for local preview

**`shared/sqliteDatabase.ts`** — Helper to open sql.js databases:
- WASM-based SQLite via `initSqlJs`
- Loads existing DB from disk or creates empty
- `persist()` writes `database.export()` back to file

**`shared/commandRunner.ts`** — Typed child process runner utility (`CommandRunner` type).

---

## 5. apps/desktop — Electron Application

**Package:** `@bubbles/desktop` (`apps/desktop/`)
**Framework:** Electron 33 + electron-vite 2 + Vite 5 + React 18 + PixiJS 8
**Dependencies:** `@bubbles/core` (workspace), `lucide-react`, `pixi.js`, `react`, `react-dom`, `sql.js`

### 5.1 Main Process (`src/main/main.ts`)

The ~1,570-line main process file is the application hub:

**Window Management:**
- **Avatar window** — 340×390px, transparent, frameless, always-on-top (`screen-saver` level), visible on all workspaces
- **Panel window** — 1120×760px, frameless, always-on-top (`floating` level), positioned relative to avatar
- Both use the same preload script with `contextIsolation: true` and `nodeIntegration: false`
- Renderer loads `?window=avatar` or `?window=panel` to select layout

**Application State:**
- Single `AppState` object maintained in the main process:
  - `activeTaskId`, `activeAgent`, `avatarState`
  - `messages` (chat history), `approvals`, `connectors`
  - `availableAgents`, `recentMemories`, `timelineEvents`, `taskEvents`
  - `voiceState`
- All mutations call `broadcastAppState()` to push state to both windows

**Message Routing Pipeline:**
1. Check for explicit `remember ...` command → save to memory store
2. Check for connector setup command (`connect gmail`, `setup calendar`, etc.) → configure connector
3. Route through `flowRouter` for capability-specific flows (email, calendar, search, creative, landing page)
4. Fallback: start CLI task via `taskController.startTask()` + extract memories in parallel

**Service Initialization (on `app.whenReady()`):**
- Voice IPC + native speech playback
- MCP client with fetch + command runner
- Secure key store (macOS Keychain)
- MiniMax setup service
- Agent registry (from `agents/` directory)
- Memory + timeline stores (SQLite in `userData/data/`)
- Approval service + connector registry
- Task IPC with CLI bridge
- Artifact protocol registration (`bubbles-artifact://`)

**Feature Flags (environment variables):**

| Variable | Controls |
|----------|----------|
| `BUBBLES_VOICE_ENABLED` | Voice features |
| `BUBBLES_VOICE_APPROVALS_ENABLED` | Voice-based approval |
| `BUBBLES_CONNECTORS_GMAIL_REAL` | Real Gmail vs fixture |
| `BUBBLES_CONNECTORS_CALENDAR_REAL` | Real Calendar vs fixture |
| `BUBBLES_CREATIVE_IMAGE` | Image generation |
| `BUBBLES_CREATIVE_MUSIC` | Music generation |
| `BUBBLES_CODING_LANDING_PAGE` | Landing page generation |
| `BUBBLES_MINIMAX_MEDIA_FIXTURE` | Fixture mode for MiniMax media |
| `BUBBLES_QA_TASK_DELAY_MS` | Artificial delay for QA testing |

### 5.2 IPC Modules (`src/main/ipc/`)

| Module | Channels | Purpose |
|--------|----------|---------|
| `setupIpc.ts` | `setup:*` | MiniMax setup flow: install CLI, save keys, retry checks, status broadcast |
| `taskIpc.ts` | `tasks:*` | Wires `CliBridge` + `TaskOrchestrator` to IPC; resolves `mmx` binary path |
| `approvalIpc.ts` | `approvals:*` | Approval CRUD with resolution callbacks |
| `approvalVoiceIpc.ts` | `voice:resolve-approval` | Voice-based approval resolution |
| `connectorIpc.ts` | `connectors:*` | Connector CRUD with feature-gated updates and health checks |
| `capabilityIpc.ts` | `capabilities:*` | Artifact file opening |
| `voiceIpc.ts` | `voice:*` | Voice session lifecycle, transcript submission, TTS, barge-in |
| `speechPlayback.ts` | (internal) | Native macOS TTS via `say` command |
| `windowMessaging.ts` | (internal) | Safe `webContents.send` helper for broadcasting to windows |

### 5.3 Preload Bridge (`src/main/preload.ts`)

Exposes `window.bubbles` via `contextBridge.exposeInMainWorld()`:

```
window.bubbles
├── getState()                    Get current AppState
├── onStateChange(cb)             Subscribe to state pushes
├── sendMessage(text)             Submit user message
├── setAvatarState(state)         Set avatar animation
├── togglePanel() / closePanel()  Window management
├── moveWindowBy(delta)           Drag support
├── platform                      Process platform string
├── phase                         Current build phase identifier
├── agents
│   ├── list() / activate(id)
│   ├── previewBirth(request)
│   └── createFromPreview(draft)
├── approvals
│   ├── list() / create(input)
│   ├── approve(id) / deny(id) / cancel(id)
├── connectors
│   ├── list() / update(id, input)
│   ├── healthCheck(id) / disconnect(id)
├── capabilities
│   └── openArtifact(input)
├── memory
│   ├── list() / timeline() / clear()
├── logs
│   └── exportRedacted()
├── voice
│   ├── startSession() / stopSession()
│   ├── submitTranscript(input) / submitPartialTranscript(input)
│   ├── speak(input) / stopSpeaking(input)
│   ├── bargeIn(input)
│   ├── resolveApproval(input)
│   ├── getState() / onEvent(cb)
├── setup
│   ├── getStatus() / retry()
│   ├── installCli()
│   ├── saveGeneralApiKey(key) / saveTokenPlanKey(key)
│   ├── resetGeneralApiKey() / resetTokenPlanKey() / resetAllMiniMax()
│   └── onStatusChange(cb)
└── tasks
    ├── start(text) / cancel(id)
    ├── getEvents() / onEvent(cb)
```

### 5.4 Renderer (`src/renderer/`)

**Entry:** `main.tsx` → `App.tsx`

**No React Router** — window role is determined by URL query parameter `?window=avatar|panel`. Same bundle, two layouts.

**State management:** Local React state mirrors the main process `AppState`. Initial fetch via `getState()`, live updates via `onStateChange()`. All user actions call `window.bubbles.*` and merge returned state.

**App.tsx layout logic:**
- `windowRole === 'panel'` → renders `AssistantPanel`
- `windowRole === 'avatar'` → renders `FloatingAvatarWindow` + optional inline `AssistantPanel` (demo fallback when `window.bubbles` is absent)

**Component tree:**

| Component | File | Role |
|-----------|------|------|
| `FloatingAvatarWindow` | `components/FloatingAvatarWindow.tsx` | Draggable transparent window with avatar sprite and speech bubble |
| `AssistantPanel` | `components/AssistantPanel.tsx` | Full workspace: header, chat, agents, tasks, approvals, settings |
| `ChatSurface` | `components/ChatSurface.tsx` | Message list with user/bubbles messages, artifacts, and citations |
| `AgentSwitcher` | `components/AgentSwitcher.tsx` | Dropdown to switch active agent |
| `ApprovalModal` | `components/ApprovalModal.tsx` | Pending approval with approve/deny/cancel |
| `TaskDrawer` | `components/TaskDrawer.tsx` | Active task events and cancel button |
| `VoiceControls` | `components/VoiceControls.tsx` | Voice session start/stop and status |
| `CaptionBar` | `components/CaptionBar.tsx` | Voice caption display |
| `ConversationRail` | `components/ConversationRail.tsx` | Left rail: chat + agents |
| `ConversationHistory` | `components/ConversationHistory.tsx` | Historical conversations |
| `WorkspaceHeader` | `components/WorkspaceHeader.tsx` | Top bar with title and controls |
| `WorkspaceStatusRail` | `components/WorkspaceStatusRail.tsx` | Right rail: settings, connectors, memory |
| `IntegrationStatusBar` | `components/IntegrationStatusBar.tsx` | Connector status indicators |

**Screen components** (embedded widgets, not route pages):

| Screen | File | Purpose |
|--------|------|---------|
| `SetupScreen` | `screens/SetupScreen.tsx` | MiniMax CLI setup flow UI |
| `ConnectorSettings` | `screens/ConnectorSettings.tsx` | Connector management and health |
| `MemoryTimeline` | `screens/MemoryTimeline.tsx` | Memory and timeline display |
| `AgentBirthPreview` | `screens/AgentBirthPreview.tsx` | Agent creation preview UI |

**Voice hook:** `useVoiceSession` (`voice/useVoiceSession.ts`) coordinates `window.bubbles.voice` with chat submission, TTS triggering, barge-in, and approval voice commands.

**Styling:** Hand-written CSS (`styles.css`) with CSS variables (teal/mist palette, glass panels, workspace layout). Icons from `lucide-react`. No external UI framework.

### 5.5 Avatar System (`src/avatar/`)

**`AvatarStage.tsx`** — PixiJS-based animated sprite renderer:
- Dynamic `import('pixi.js')` to avoid issues in test environments
- Creates `Application` + `AnimatedSprite` from spritesheet tiles
- Skips Pixi rendering when `import.meta.env.MODE === 'test'`

**`animationCatalog.ts`** — Maps avatar states to animation frame ranges:
- Loads `bubbles_mvp.json` spritesheet metadata
- Provides `normalizeAvatarState` and `getAvatarPlayback` for state transitions
- 9 animation states with 6-8 frames each on an 8×9 atlas grid

**`bubbles_mvp.json`** — Spritesheet metadata (frame positions, sizes, animation sequences).

### 5.6 Build Configuration

**`electron.vite.config.ts`** — electron-vite with three build targets:
- **Main:** `src/main/main.ts` entry, `sql.js` externalized via Rollup
- **Preload:** `src/main/preload.ts` entry
- **Renderer:** `index.html` entry with `@vitejs/plugin-react`

**`vite.config.ts`** — Vitest-only configuration (jsdom environment, React plugin, globals enabled).

**TypeScript split:**
- `tsconfig.node.json` → main + preload + Vite configs (NodeNext resolution)
- `tsconfig.web.json` → renderer + avatar + tests (Bundler resolution, vite/client types)

**`electron-builder.yml`** — Packages `out/**` + `package.json`, macOS DMG/ZIP targets.

---

## 6. Data Flow

### 6.1 User Message Pipeline

```
User types message → submit
    │
    ▼
Renderer: window.bubbles.sendMessage(text)
    │
    ▼ (IPC invoke)
Main: app:send-message handler
    │
    ├── 1. parseExplicitRememberCommand(text)
    │       → If match: save memory, append timeline, broadcast
    │
    ├── 2. handleConnectorSetupCommand(text)
    │       → If match: configure connector, broadcast
    │
    ├── 3. routeCapabilityFlow(text)
    │       → classifyIntent(text)
    │       → flowRouter.route(text, agentId)
    │       → If handled: execute capability, append messages, broadcast
    │
    └── 4. taskController.startTask(text)  [fallback]
            → buildTaskPacket(text, agent, memory)
            → cliBridge.start(packet)
            → spawn mmx text chat --message <packet>
            → stream CliEvents → update state → broadcast
            │
            └── (parallel) extractMemoriesFromMessage(text)
                → generateMiniMaxJson → save extracted memories
```

### 6.2 Approval Flow

```
Action requires approval (email send, calendar update, agent create, etc.)
    │
    ▼
approvalService.create(request)
    → classifyApprovalRisk(actionType) → assign risk level
    → redactPreview(preview) → sanitize sensitive data
    → persist to approvals.sqlite
    │
    ▼
Avatar state → 'waiting_approval'
UI shows ApprovalModal with action details
    │
    ├── User approves (click or voice "yes"/"approve")
    │   → approvalService.resolve(id, 'approved')
    │   → Execute action (send email, create event, write agent files, etc.)
    │   → Append timeline event + approval_history memory
    │   → Avatar state → 'celebrating'
    │
    ├── User denies
    │   → approvalService.resolve(id, 'denied')
    │   → Avatar state → 'idle'
    │
    └── User cancels
        → approvalService.resolve(id, 'cancelled')
        → Avatar state → 'idle'
```

### 6.3 IPC Communication

```
Main → Renderer (push):
    webContents.send('app:state', appState)        Full state broadcast
    webContents.send('tasks:event', event)          Individual task events
    webContents.send('voice:event', event, state)   Voice events
    webContents.send('setup:status', status)        Setup status changes
    webContents.send('panel:state', isOpen)          Panel open/close

Renderer → Main (request/response):
    ipcRenderer.invoke('app:send-message', text)    User message
    ipcRenderer.invoke('agents:activate', id)       Agent switch
    ipcRenderer.invoke('approvals:approve', id)     Approval action
    ipcRenderer.invoke('connectors:update', ...)    Connector config
    ipcRenderer.invoke('voice:start-session')       Voice control
    ipcRenderer.invoke('setup:retry')               Setup retry
    ... (40+ channels total)
```

---

## 7. Persistence

### 7.1 SQLite Databases

All databases use sql.js (WASM SQLite) stored in Electron `userData/data/`:

| Database | Table | Key Fields |
|----------|-------|------------|
| `memory.sqlite` | `memories` | id, type, content (redacted), sourceTaskId, agentId, tags, importance, timestamps |
| `timeline.sqlite` | `timeline_events` | id, type, title, summary (redacted), taskId, agentId, memoryId, metadata, createdAt |
| `approvals.sqlite` | `approvals` | id, taskId, agentId, actionType, risk, title, explanation, preview (redacted), status, timestamps |
| `connectors.sqlite` | `connectors` | id, name, type, enabled, mode, authStatus, healthStatus, allowedAgents, requiredApproval, launchConfig (redacted), timestamps |

### 7.2 Filesystem Storage

| Path | Content |
|------|---------|
| `agents/<id>/agent.json` | Agent profile (JSON) |
| `agents/<id>/skills.md` | Agent skills (Markdown) |
| `userData/task-logs/<taskId>.log` | Redacted task event logs (JSON lines) |
| `userData/task-logs/observability.ndjson` | Structured trace events |
| `userData/tools/mmx-cli/` | App-local MiniMax CLI installation |
| `userData/artifacts/` | Generated media files (images, audio, sites) |

---

## 8. Security Model

### 8.1 Secret Redaction

`redactSecrets()` is applied comprehensively across the codebase:
- All task logs and observability traces
- Memory content on write and migration
- Timeline summaries and metadata
- Approval previews (recursive object redaction)
- CLI stdout/stderr output
- MCP client payloads and errors
- Connector launch config args and env vars
- Error messages surfaced to the UI

Patterns stripped: `--api-key <value>`, Bearer tokens, `sk-` prefixed keys, `MINIMAX_API_KEY` env values.

### 8.2 Secure Key Storage

API keys are stored in macOS Keychain via `/usr/bin/security` CLI:
- Separate keychain services for General API key and Token Plan key
- Keys are never stored in plaintext on disk or in databases
- All keychain errors pass through `redactSecrets`

### 8.3 Approval Gating

All sensitive actions require explicit user approval:
- Email sending (`send_email` — high risk)
- Calendar updates (`calendar_update` — medium risk)
- File writes (`file_write` — medium risk)
- Shell commands (`shell_command` — high risk)
- CLI installations (`cli_install` — high risk)
- Agent creation (`agent_file_create` — medium risk)
- External data sends (`external_data_send` — high risk)

### 8.4 Process Isolation

- Renderer runs with `contextIsolation: true` and `nodeIntegration: false`
- All privileged operations go through the preload bridge
- Custom `bubbles-artifact` protocol validates paths against artifact root
- `assertWorkflowCommandsAllowed` validates shell commands before execution

---

## 9. Testing

### 9.1 Test Framework

- **Runner:** Vitest 2 for both packages
- **Renderer environment:** jsdom
- **Component testing:** React Testing Library + jest-dom matchers
- **Test setup:** `apps/desktop/src/test/setup.ts` (jest-dom imports)

### 9.2 Test Coverage

**Core package** — co-located `*.test.ts` files for every module:
- `agents/` — agentBirthService, agentRegistry, agentSchema
- `approvals/` — approvalService, riskClassifier, voiceApprovalResolver
- `cli/` — cliBridge, cliEventParser, taskPacketBuilder
- `coding/` — landingPageRunner
- `connectors/` — all 7 connector modules
- `memory/` — memoryStore, memoryExtractor
- `minimax/` — all 5 minimax modules
- `observability/` — trace
- `orchestration/` — flowRouter, intentClassifier, orchestrator, responsePresenter
- `security/` — redactSecrets, secureKeyStore
- `timeline/` — timelineStore
- `voice/` — all 4 voice modules

**Desktop package** — co-located `*.test.tsx` / `*.test.ts` files:
- `App.test.tsx` — comprehensive test mocking `window.bubbles`
- `components/` — AgentSwitcher, ApprovalModal, CaptionBar, ChatSurface, TaskDrawer, VoiceControls
- `screens/` — AgentBirthPreview, ConnectorSettings, MemoryTimeline, SetupScreen
- `ipc/` — approvalVoiceIpc, capabilityIpc, connectorIpc, speechPlayback, voiceIpc, windowMessaging
- `avatar/` — avatarCatalog
- `voice/` — useVoiceSession

### 9.3 Running Tests

```bash
npm test                  # Run all tests (both packages)
npm run test:core         # Core package only
npm run test:desktop      # Desktop package only
npm run typecheck         # Type check all packages
npm run typecheck:core    # Type check core only
npm run typecheck:desktop # Type check desktop only
```

---

## 10. File Inventory

### 10.1 packages/core/src/ (38 source files + 37 test files)

```
src/
├── index.ts                              Barrel export
├── agents/
│   ├── agentBirthService.ts              AI agent creation
│   ├── agentRegistry.ts                  Filesystem agent registry
│   └── agentSchema.ts                    Profile validation
├── approvals/
│   ├── approvalService.ts                SQLite approval CRUD
│   ├── riskClassifier.ts                 Action risk classification
│   └── voiceApprovalResolver.ts          Voice approval resolution
├── cli/
│   ├── cliBridge.ts                      MiniMax CLI process manager
│   ├── cliEventParser.ts                 CLI output parser
│   └── taskPacketBuilder.ts              Task packet assembly
├── coding/
│   └── landingPageRunner.ts              Sandboxed site generation
├── connectors/
│   ├── calendarConnector.ts              Calendar integration
│   ├── connectorRegistry.ts             SQLite connector CRUD
│   ├── emailConnector.ts                 Email integration
│   ├── googleWorkspaceScopes.ts          OAuth scope configs
│   ├── localFilesConnector.ts            Local file access
│   ├── mcpClient.ts                      MCP JSON-RPC client
│   └── webSearchConnector.ts             Web search integration
├── memory/
│   ├── memoryExtractor.ts                AI memory extraction
│   └── memoryStore.ts                    SQLite memory store
├── minimax/
│   ├── creativeService.ts                Image/music generation
│   ├── minimaxApiClient.ts               MiniMax REST API client
│   ├── minimaxCliManager.ts              mmx CLI management
│   ├── setupService.ts                   Setup state machine
│   └── ttsService.ts                     Text-to-speech
├── observability/
│   └── trace.ts                          Structured trace events
├── orchestration/
│   ├── flowRouter.ts                     Capability routing
│   ├── intentClassifier.ts               Intent classification
│   ├── orchestrator.ts                   Task orchestration
│   └── responsePresenter.ts              Response formatting
├── security/
│   ├── redactSecrets.ts                  Secret redaction
│   └── secureKeyStore.ts                 Keychain integration
├── shared/
│   ├── commandRunner.ts                  Process runner utility
│   ├── sqliteDatabase.ts                 sql.js helper
│   └── types.ts                          Shared type definitions
├── timeline/
│   └── timelineStore.ts                  SQLite timeline store
└── voice/
    ├── affectDetector.ts                 Affect detection
    ├── approvalVoiceDecision.ts          Voice approval phrases
    ├── spokenResponsePolicy.ts           TTS policy
    └── voiceTypes.ts                     Voice type definitions
```

### 10.2 apps/desktop/src/ (42 source files + 17 test files)

```
src/
├── avatar/
│   ├── AvatarStage.tsx                   PixiJS sprite renderer
│   ├── animationCatalog.ts               Animation state mapping
│   └── bubbles_mvp.json                  Spritesheet metadata
├── main/
│   ├── main.ts                           Electron main process hub
│   ├── preload.ts                        Context bridge API
│   └── ipc/
│       ├── approvalIpc.ts                Approval IPC handlers
│       ├── approvalVoiceIpc.ts           Voice approval IPC
│       ├── capabilityIpc.ts              Artifact IPC
│       ├── connectorIpc.ts              Connector IPC
│       ├── setupIpc.ts                   Setup IPC
│       ├── speechPlayback.ts             Native TTS
│       ├── taskIpc.ts                    Task IPC
│       ├── voiceIpc.ts                   Voice IPC
│       └── windowMessaging.ts            IPC broadcast helper
├── renderer/
│   ├── App.tsx                           Root React component
│   ├── global.d.ts                       window.bubbles type declarations
│   ├── main.tsx                          React entry point
│   ├── styles.css                        Application styles
│   ├── components/
│   │   ├── AgentSwitcher.tsx
│   │   ├── ApprovalModal.tsx
│   │   ├── AssistantPanel.tsx
│   │   ├── CaptionBar.tsx
│   │   ├── ChatSurface.tsx
│   │   ├── ConversationHistory.tsx
│   │   ├── ConversationRail.tsx
│   │   ├── FloatingAvatarWindow.tsx
│   │   ├── IntegrationStatusBar.tsx
│   │   ├── TaskDrawer.tsx
│   │   ├── VoiceControls.tsx
│   │   ├── WorkspaceHeader.tsx
│   │   └── WorkspaceStatusRail.tsx
│   ├── connectors/
│   │   └── googleWorkspaceSetup.ts
│   ├── screens/
│   │   ├── AgentBirthPreview.tsx
│   │   ├── ConnectorSettings.tsx
│   │   ├── MemoryTimeline.tsx
│   │   └── SetupScreen.tsx
│   └── voice/
│       └── useVoiceSession.ts
└── test/
    └── setup.ts                          Test setup (jest-dom)
```

---

## 11. Key Design Decisions

1. **Hybrid connector model** — Every connector supports both `real` (live API via MCP) and `fixture` (canned data) modes, enabling CI testing and demo flows without credentials.

2. **Approval-gated actions** — All sensitive actions require explicit user approval, with risk classification and optional voice-based approval. This is a core product safety guarantee.

3. **MiniMax as the AI backend** — The `mmx` CLI is the primary AI interface for general tasks, while the REST API handles structured JSON generation (agent birth, memory extraction). The app-local CLI binary avoids PATH conflicts.

4. **Two-window architecture** — A small always-on-top avatar window + a larger panel window communicate via shared IPC state. This enables the "desktop pet" experience while providing a full workspace when needed.

5. **Single source of truth in main** — All state lives in the Electron main process. The renderer is a thin, typed client over the preload bridge with no direct access to Node APIs.

6. **Secret redaction everywhere** — `redactSecrets()` is applied to every output path: logs, databases, error messages, CLI output, MCP payloads. No raw secrets should ever be visible to the user or persisted.

7. **Factory + dependency injection** — All core services use `createXxx` factories with injected dependencies, making them fully testable without mocking modules.

8. **Filesystem-backed agents** — Agent profiles are JSON + Markdown files on disk rather than database rows, making them easy to version control, inspect, and manually edit.

9. **sql.js for persistence** — Using WASM SQLite via sql.js avoids native module compilation issues in Electron while providing full SQL capabilities.

10. **Comprehensive test coverage** — Nearly every module has co-located tests. Core tests use Vitest directly; renderer tests use jsdom + React Testing Library.
