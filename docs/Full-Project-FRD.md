# Bubbles — Technical Build Plan

## Context

**Bubbles** is a 2D pixel-art desktop pet that doubles as a personal multi-agent AI workstation. The same on-screen avatar transforms (sprite skin, voice, personality, tools) based on the active specialist agent (coding, research, design, planning, writing, trading, etc.). Each agent is defined by a `skills.md` file plus config and assets, can be created on the fly via the *Agent Birth System*, and can collaborate with other agents under Bubbles' coordination. A persistent local *Bubble Memory Core* gives every agent long-term recall over projects, files, decisions, and conversations. A *Permission & Safety Layer* gates every file write, edit, or external action behind a preview-and-approve UI.

This plan is scoped for a solo / small-team build, targeting Windows first (the dev machine is Win 11), with a path to macOS/Linux later via Electron's cross-platform shell.

### Stack decisions (locked)

| Concern | Choice |
|---|---|
| Desktop shell | **Electron + React + TypeScript + Vite + Tailwind** |
| Avatar rendering | **Pixel-art sprite sheets** rendered via **PixiJS** (hybrid: hand-drawn base + AI-generated agent variants) |
| Agent runtime location | **Local** (in Electron main process) — MiniMax APIs called directly with user's key |
| LLM / TTS / Voice clone / Image | **MiniMax** (M2.7, Speech-02, voice clone, image API) — the spec mandates MiniMax everywhere it fits |
| Memory store | **SQLite (better-sqlite3) + sqlite-vec** for embeddings |
| Tool model | **MCP-native** — Bubbles is an MCP client; built-in tools and community MCP servers both work |
| Scope | **Phased: MVP → V1 → V2** with voice features included from MVP |

---

## High-Level Architecture

```
+-----------------------------------------------------------------+
|                    ELECTRON APP (Bubbles)                       |
|                                                                 |
|  +-------------------+        +-----------------------------+   |
|  |  RENDERER (React) |  IPC   |     MAIN PROCESS (Node)     |   |
|  |                   | <----> |                             |   |
|  |  - Avatar window  |        |  Agent Runtime              |   |
|  |  - Chat panel     |        |   - AgentManager            |   |
|  |  - Permission UI  |        |   - AgentLoop (ReAct)       |   |
|  |  - Memory Timeline|        |   - Coordinator (multi)     |   |
|  |  - Agent Birth    |        |   - ToolRegistry (MCP)      |   |
|  |  - PixiJS sprite  |        |   - PermissionGuard         |   |
|  |    engine         |        |  Memory Core (SQLite+vec)   |   |
|  |                   |        |  MiniMax Clients            |   |
|  +-------------------+        |   - Chat/M2.7  - TTS Speech |   |
|                               |   - Voice Clone - Image     |   |
|                               |   - Embeddings              |   |
|                               |  MCP Client (filesystem,    |   |
|                               |    github, web, custom...)  |   |
|                               |  File watcher, system tray  |   |
|                               +-----------------------------+   |
+-----------------------------------------------------------------+
        |                              |                  |
        v                              v                  v
   ~/.bubbles/                   MiniMax Cloud APIs   MCP Servers
   agents/, memory.db,           (M2.7, Speech-02,    (stdio/HTTP)
   timeline.db, sprites/         voice clone, image)
```

### Process & window topology

- **Main process (Node)** owns: agent runtime, all I/O, MiniMax/MCP clients, SQLite, audio playback. No long-running work in renderer.
- **Renderer windows**:
  - `AvatarWindow` — frameless, transparent, always-on-top, draggable, click-through outside the sprite alpha mask. Hosts PixiJS canvas + speech bubble.
  - `ChatPanelWindow` — anchored sibling window that pops out next to the avatar; mini chat, attach file, plan-mode button, agent switcher, memory button.
  - `MainWindow` (lazy) — full-size workspace for Memory Timeline, Agent Birth wizard, Settings, Project view.
  - `PermissionPreviewWindow` — modal-style, shows diffs / file previews / planned tool calls before approval.
- **System tray icon** with mood indicator (sleeping/thinking/listening/done).

### IPC contract

All renderer↔main calls go through a typed `bridge` exposed via `contextBridge.exposeInMainWorld`. Channel groups:

| Channel | Purpose |
|---|---|
| `agent:*` | list/create/switch/update agents, run a turn, stream tokens back |
| `memory:*` | query, insert, semantic search, timeline read |
| `tool:*` | list available tools, request approval, get approval result |
| `mcp:*` | list servers, install, restart |
| `voice:*` | tts.play, stt.listen (later), voice.clone |
| `sprite:*` | load skin, play animation, set mood |
| `file:*` | read/write through PermissionGuard |
| `project:*` | create, switch, list |
| `app:*` | quit, minimize, settings, telemetry opt-in |

Streaming uses an `EventEmitter`-style channel: main pushes `agent:stream:<turnId>` chunks; renderer subscribes via `ipcRenderer.on`.

---

## Repository Layout

```
bubbles/
├── apps/
│   ├── desktop/                # Electron app (main + preload)
│   │   ├── src/main/           # Main process entry, window mgmt, IPC
│   │   ├── src/preload/        # contextBridge API surface
│   │   └── electron.vite.config.ts
│   └── renderer/               # React app
│       ├── src/avatar/         # PixiJS sprite engine, mood controller
│       ├── src/chat/           # chat panel, speech bubble, attach
│       ├── src/agents/         # agent switcher, birth wizard, editor
│       ├── src/memory/         # timeline UI, search
│       ├── src/permission/     # preview modal, diff viewer
│       └── src/shared/         # zustand stores, types, hooks
├── packages/
│   ├── agent-runtime/          # AgentManager, AgentLoop, Coordinator
│   ├── memory-core/            # SQLite + sqlite-vec wrapper, schemas
│   ├── minimax-client/         # M2.7 chat, Speech-02, voice clone, image, embeddings
│   ├── mcp-bridge/             # MCP client, server registry
│   ├── tool-kit/               # built-in tools (file, web, plan, image-gen)
│   ├── permission-guard/       # diff/preview generation, approval queue
│   ├── sprite-pipeline/        # Aseprite JSON loader, AI variant generator
│   └── shared-types/           # cross-package TS types, IPC schema (zod)
├── assets/
│   ├── sprites/bubbles/        # hand-drawn base sheets (idle, blink, walk, sleep, think, talk, celebrate, confused)
│   └── sprites/skins/          # generated agent overlay palettes
├── scripts/
│   ├── gen-agent-sprite.ts     # invokes MiniMax image API + post-processes to sheet
│   └── seed-mcp-servers.ts
└── tests/                      # vitest + playwright (Electron)
```

Monorepo via **pnpm workspaces** + **Turborepo**.

---

## Subsystem Designs

### 1. Avatar & Sprite Engine

- **PixiJS v8** in the renderer for hardware-accelerated 2D rendering (avoid React reconciliation for animation).
- **Aseprite** as the authoring tool. Export → JSON sprite-sheet (`.json` + `.png`).
- `sprite-pipeline` loads sheets, exposes a `Character` class with:
  - `playAnimation(name, opts)` — idle, blink, walk, sleep, think, talk, celebrate, confused, listen, plan, research, write
  - `setMood(mood)` — picks an animation set + tints palette
  - `lipSync(audioBuffer)` — opens/closes mouth frames in time with TTS amplitude
  - `setSkin(skinId)` — swaps the sprite atlas (agent transformation)
- **Hybrid asset pipeline**:
  - **Base** (Bubbles) = hand-drawn 64×64 (or 128×128 for HiDPI) sheets for ~12 animations.
  - **Agent variants** = generated by `scripts/gen-agent-sprite.ts`:
    1. Call MiniMax image API with prompt: *"recolor this 64x64 pixel-art creature with a [coding/research/design] palette: glasses, hat, accessory X, palette Y"*.
    2. Quantize back to a fixed palette (Pillow / sharp).
    3. Compose accessory layer onto base atlas.
    4. Save Aseprite-compatible JSON.
  - Output cached under `~/.bubbles/agents/<id>/sprites/`.
- Window is transparent + frameless, with `setIgnoreMouseEvents` + `forwarder` so clicks only land on visible pixels (alpha mask hit-testing).

### 2. Agent Runtime (`packages/agent-runtime`)

Core types:

```ts
interface Agent {
  id: string;
  name: string;
  persona: { tone: string; style: string; emoji?: string };
  skinId: string;           // sprite skin
  voiceId: string;          // MiniMax voice id (or cloned voice id)
  systemPrompt: string;     // compiled from skills.md
  toolWhitelist: string[];  // MCP tool names this agent may call
  rules: string[];          // hard constraints from skills.md
  memoryScope: 'agent' | 'project' | 'global';
  model: 'minimax-m2-7' | 'minimax-m2-7-highspeed';
  createdAt: number;
}
```

**`AgentLoop`** — a ReAct-style loop in the main process:

```
loop turn:
  1. assemble messages = [system, memory.recall(query), history, user]
  2. call MiniMaxChatClient.stream({ tools: registry.forAgent(agent), messages })
  3. while (toolCall in stream):
       a. PermissionGuard.review(toolCall)         # may pause for UI approval
       b. result = ToolRegistry.invoke(toolCall)
       c. emit('tool:done', result)
       d. feed result back into model (streaming continues)
  4. finalise text -> send to renderer + TTS pipeline
  5. memory.write(turn summary, embeddings)
  6. timeline.append(event)
```

- Cancellable via `AbortController` (the user can interrupt by clicking Bubbles).
- Token budget enforcement + automatic summarisation when context > 80% of M2.7's 228k window.

**`Coordinator`** (V2) — Bubbles is itself an agent that can plan and delegate:

- Receives a high-level user goal.
- Calls a `delegate(agentName, subtask)` tool.
- Spawns child `AgentLoop` instances; results stream back to a synthesizer step.
- Concurrency cap (default 3 parallel agents) to control MiniMax spend.
- Conversation tree persisted so timeline shows the collaboration.

### 3. `skills.md` Format

A versioned Markdown format the agent runtime parses on load. Example:

```markdown
---
name: Coda
role: coding
voice: minimax-male-warm
skin: coda-glasses-dark
model: minimax-m2-7
tools: [filesystem, github, web_search, code_runner, plan_mode]
memory_scope: project
---

# Personality
Direct, dry humour, ships small diffs. Asks before refactoring.

# Capabilities
- Read/edit code in the active project workspace
- Run tests via `code_runner`
- Open PRs via `github` MCP server

# Rules
- Never edit files outside the active project root
- Always show a diff preview before write
- Prefer the smallest change that solves the problem
- If unsure, ask one clarifying question

# Few-shot examples
... (optional)
```

A `SkillsCompiler` turns this into the runtime `Agent` object: frontmatter → fields, body → composed system prompt with sections injected as labelled blocks.

### 4. MiniMax Integration (`packages/minimax-client`)

A typed wrapper over MiniMax REST endpoints. One client class per capability; share an `auth.ts` with the user's API key (stored via Electron `safeStorage`).

| Capability | Endpoint family | Used for |
|---|---|---|
| Chat / function-calling | M2.7 chat completion (streaming, tools array) | All agent reasoning |
| TTS realtime | Speech-02-Turbo | Live agent speech, low latency |
| TTS narration | Speech-02-HD | Long passages, Memory Timeline read-aloud |
| Voice cloning | Voice Clone API (≥10s sample) | Per-agent unique voice (Agent Birth) |
| Image gen | MiniMax image API | Agent sprite variant base, in-chat illustrations |
| Embeddings | MiniMax embeddings (or local fallback `bge-small`) | Semantic memory recall |
| MCP server | Official `MiniMax-MCP-JS` | Optional: route image/video/voice tools through MCP for uniformity |

Implementation notes:
- One `BackoffQueue` per capability (HTTP 429 handling, jittered exponential).
- Streaming chat parsed via SSE; tool-call deltas accumulated until `finish_reason=tool_calls`.
- All requests tagged with `x-bubbles-turn-id` for traceability into the timeline.
- Cost meter writes per-call token + character usage into `memory.db` so a Settings page can show monthly spend.

### 5. Bubble Memory Core (`packages/memory-core`)

**SQLite (better-sqlite3) + sqlite-vec** in `~/.bubbles/memory.db`.

Schema (core tables):

```sql
projects(id, name, root_path, created_at)
agents(id, name, role, voice_id, skin_id, skills_md_path, project_id NULL, created_at)
conversations(id, agent_id, project_id, started_at, summary)
messages(id, conversation_id, role, content, tool_calls JSON, created_at)
memories(id, kind, scope, agent_id NULL, project_id NULL, content,
         source_message_id NULL, created_at)
memories_vec(rowid, embedding) -- sqlite-vec virtual table
files(id, project_id, path, sha, last_seen_at)
decisions(id, project_id, title, rationale, made_at)
timeline_events(id, kind, ref_id, summary, occurred_at)
permissions(id, tool_name, payload_hash, decision, decided_at)
mcp_servers(id, name, command, args, env, status)
```

**Memory kinds**: `agent` (about an agent's evolution), `project` (project facts), `conversation` (turn summaries), `file` (file purpose / structure), `relationship` (links between memories — stored as JSON adjacency).

**Recall flow** (called by `AgentLoop` step 1):
1. Embed query via MiniMax embeddings.
2. `sqlite-vec` k-NN top 20.
3. Re-rank with a quick MiniMax M2.7-highspeed call: *"which of these are most relevant to: <query>?"*.
4. Return top 5 + their structured neighbours (agent/project/file rows joined).

**Memory Timeline** = `timeline_events` with a UI grouped by day → hour, filterable by agent/project. Each entry links back to the originating message/file/decision.

### 6. Tool Registry & MCP Bridge (`packages/mcp-bridge`, `packages/tool-kit`)

- **MCP client** built on `@modelcontextprotocol/sdk` (TypeScript).
- Built-in MCP servers shipped with Bubbles:
  - `filesystem` (Anthropic ref) scoped to active project root
  - `web_search` (Brave or Tavily) — plus the loaded `mcp__claude_ai_Tavily__*` style servers if user adds them
  - `code_runner` (executes in a child Node process, time-boxed)
  - `plan_mode` (lets the agent draft a plan, gate it on user approval)
  - `bubbles.image` (wraps MiniMax image API)
  - `bubbles.voice` (wraps MiniMax voice clone for Agent Birth)
- Users add more MCP servers via Settings → Tools (drop-in `command`/`args`).
- `ToolRegistry.forAgent(agent)` filters by `toolWhitelist` from `skills.md`.

### 7. Permission & Safety Layer (`packages/permission-guard`)

- Every tool call passes through `PermissionGuard.review(call)` before execution.
- Guard categorises: `read`, `write`, `external`, `execute`.
- Policy cascade:
  1. **Whitelist** (auto-allow): pure reads on project root, web_search.
  2. **Per-call preview**: writes/edits show a diff (Monaco diff editor); shell/code_runner shows the command + cwd; external API calls show payload preview.
  3. **Remember choice**: per-tool, per-agent, per-project — `permissions` table records hashed payloads + decisions.
- Approval UI is a dedicated window (`PermissionPreviewWindow`) so the agent loop can block on a Promise.
- Hard rules from `skills.md` are enforced *before* the model is even called (never sent as suggestions).

### 8. Voice Pipeline

- **Output**: M2.7 finishes a sentence → push to `voice:tts:queue` → `Speech-02-Turbo` streams MP3 chunks → `node-speaker` plays them; mouth frames driven by amplitude envelope.
- **Per-agent voices**: `voiceId` on the agent. New agents get a default preset; users can record a 10s sample → `voice clone` → returns a `voice_id` stored on the agent.
- **Input** (V2): Whisper-cpp via `nodejs-whisper` (local) for push-to-talk; optional MiniMax STT once available.

### 9. Agent Birth System

A wizard window that calls a small chain:

1. User describes the agent in 1–3 sentences ("a calm, methodical research agent for finance").
2. M2.7 generates: `name`, `role`, `persona`, `tools` whitelist (from registry), `rules`, full `skills.md`.
3. MiniMax image API generates a sprite variant prompt (palette + accessory).
4. `sprite-pipeline` post-processes into an Aseprite-compatible sheet.
5. (Optional) user records 10s sample → voice clone → `voiceId`.
6. Insert into `agents` table; write `~/.bubbles/agents/<id>/skills.md`; reload registry.
7. Bubbles plays `celebrate` animation: "Meet Calypso!"

### 10. Self-Improvement Loop

- After a session, user can react with thumbs / "be more direct" / "you missed X".
- A background `SkillsImprover` task uses M2.7 to propose a diff to `skills.md`.
- Diff is shown via `PermissionPreviewWindow`. On approve → write file + bump version + record `timeline_event(kind='agent_improved')`.

---

## Phased Roadmap

### Phase 0 — Foundation (Week 1–2)

- [ ] Monorepo scaffold (pnpm + Turbo).
- [ ] Electron + Vite + React + TS + Tailwind boot.
- [ ] Transparent always-on-top avatar window with click-through alpha hit-test.
- [ ] PixiJS sprite engine + Aseprite loader; load placeholder Bubbles base sheet (idle/blink only).
- [ ] System tray, multi-monitor placement, settings persistence (`electron-store`).
- [ ] Typed IPC bridge with zod schemas.
- [ ] CI: typecheck, lint, vitest, Playwright-Electron smoke test.

### Phase 1 — MVP (Week 3–6) — single agent, voice from day one

- [ ] `minimax-client`: M2.7 chat streaming + Speech-02-Turbo TTS.
- [ ] `agent-runtime` v0: single-agent loop, no tools yet, just chat.
- [ ] `memory-core` v0: SQLite schema + conversations/messages persistence (no embeddings).
- [ ] Chat panel UI: speech bubble + mini chat + attach-file (read-only).
- [ ] Mood states: idle, listening, thinking, talking; lip-sync to TTS amplitude.
- [ ] First-run wizard: capture MiniMax API key (stored via `safeStorage`).
- [ ] Cost meter (per-day token + character spend).
- **Ship target**: a polished pixel-pet you can chat and listen to.

### Phase 2 — V1 (Week 7–12) — multi-agent, tools, permissions, memory recall

- [ ] `skills.md` compiler.
- [ ] Agent registry + agent switcher UI; sprite skin swap on activate.
- [ ] `mcp-bridge`: MCP client + 4 built-in servers (filesystem, web_search, code_runner, plan_mode).
- [ ] `permission-guard` + diff preview window.
- [ ] Embeddings + sqlite-vec; semantic recall in `AgentLoop`.
- [ ] Agent Birth wizard + MiniMax image generation pipeline for agent skin.
- [ ] Voice cloning per agent (10s sample → voice_id).
- [ ] Project concept: switch active project, scope filesystem to root.
- **Ship target**: real workhorse — code/research/design agents you create, each with own voice + skin + tools.

### Phase 3 — V2 (Week 13–20) — collaboration, timeline, self-improvement

- [ ] Coordinator + `delegate(agentName, subtask)` tool; concurrent child loops.
- [ ] Memory Timeline UI (filterable, grouped, with audio replay via Speech-02-HD).
- [ ] Relationship memory (graph view of agent ↔ project ↔ file ↔ decision).
- [ ] `SkillsImprover` self-improvement loop with diff approval.
- [ ] STT input (Whisper-cpp) for "talk to Bubbles".
- [ ] Hailuo video shorts: optional "agent intro reels" on birth (nice-to-have).
- [ ] Auto-update channel, telemetry opt-in, crash reporting (Sentry).
- **Ship target**: a small AI workforce that remembers and improves.

---

## Critical Files / Modules to Create

| Path | Purpose |
|---|---|
| `apps/desktop/src/main/index.ts` | Electron entry, window factory, IPC wiring |
| `apps/desktop/src/main/windows/avatar.ts` | Transparent always-on-top avatar window with alpha hit-test |
| `apps/desktop/src/preload/bridge.ts` | `contextBridge` typed API surface |
| `apps/renderer/src/avatar/SpriteEngine.ts` | PixiJS-based animation controller |
| `apps/renderer/src/chat/SpeechBubble.tsx` | Streaming text + lip-sync hook |
| `apps/renderer/src/agents/BirthWizard.tsx` | Agent Birth UI |
| `apps/renderer/src/permission/PreviewModal.tsx` | Diff/payload preview + approve |
| `packages/agent-runtime/src/AgentLoop.ts` | ReAct loop, streaming, cancellation |
| `packages/agent-runtime/src/Coordinator.ts` | Multi-agent delegation |
| `packages/agent-runtime/src/SkillsCompiler.ts` | `skills.md` → `Agent` object |
| `packages/memory-core/src/schema.sql` | All tables + sqlite-vec virtual tables |
| `packages/memory-core/src/recall.ts` | Embed → kNN → re-rank pipeline |
| `packages/minimax-client/src/chat.ts` | M2.7 streaming + tool calls |
| `packages/minimax-client/src/tts.ts` | Speech-02-Turbo + HD wrappers |
| `packages/minimax-client/src/voiceClone.ts` | Clone API, returns `voiceId` |
| `packages/minimax-client/src/image.ts` | Sprite variant generation |
| `packages/mcp-bridge/src/client.ts` | MCP client lifecycle, tool listing |
| `packages/permission-guard/src/Guard.ts` | review/policy engine |
| `packages/sprite-pipeline/src/asepriteLoader.ts` | JSON sheet → PixiJS atlas |
| `scripts/gen-agent-sprite.ts` | MiniMax image → quantize → sheet |

---

## Verification

End-to-end checks per phase. Run from repo root.

**Phase 0**
- `pnpm dev` launches transparent avatar window; tray icon present; click-through verified by clicking *behind* the avatar's empty pixels (focus stays on under-window app).
- Playwright-Electron test: avatar window opens within 2s; no console errors.

**Phase 1 (MVP)**
- Type "hello" in mini chat → avatar plays `listening` → `thinking` → `talking` with lip-sync; audible reply via Speech-02-Turbo within 1.5s of first token.
- Quit and relaunch — last conversation visible in chat panel (SQLite persistence).
- Cost meter increments correctly (compare to MiniMax dashboard).

**Phase 2 (V1)**
- Agent Birth: create "Coda the coder" → new sprite skin appears in switcher → switching activates new voice + persona within 300ms.
- Coda asked "rename `foo` to `bar` in `src/utils.ts`" → permission preview shows diff → approve → file updated, timeline_event written.
- Memory recall test: tell Bubbles a fact in conversation A; in conversation B days later, ask about it — agent recalls (semantic search hit logged).
- MCP test: install community `github` MCP server via Settings; agent successfully creates an issue with permission preview.

**Phase 3 (V2)**
- "Build me a project pitch about X" → Coordinator spawns research + planning + writing agents in parallel; timeline shows the tree; final synthesised result delivered.
- After session, thumbs-down "be less verbose" → SkillsImprover proposes diff to `skills.md` → approve → next conversation reflects change.

**Cross-cutting**
- All MiniMax calls show up in `memory.db` cost rows; `pnpm cost-report` prints last-7-days totals.
- `pnpm test` passes (vitest unit + Playwright e2e).
- `pnpm package` produces a Windows installer < 200MB; first-launch onboarding completes without manual config beyond MiniMax key.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MiniMax API latency for streaming TTS feels laggy | Use Speech-02-Turbo; pre-buffer first 2 sentences; render text first, voice second |
| Pixel-art at HiDPI looks blurry | Author at 64×64 + integer-scale (2x/3x/4x) via PixiJS `roundPixels:true` and nearest-neighbour |
| Tool calls can wreak havoc on filesystem | Hard-scope filesystem MCP to `project.root_path`; permission preview mandatory for writes |
| User context window blows past 228k | Auto-summarise oldest 30% into `conversations.summary` + memory rows |
| MiniMax key on disk = leak risk | Electron `safeStorage` (DPAPI on Windows); never log; redact in telemetry |
| MCP server crashes hang loop | 30s timeout per tool call; auto-restart server on crash; show fallback in UI |
| Voice cloning misuse | Require explicit "I have rights to this voice" checkbox; store consent flag |

---

## Open Questions (resolve during build, not blockers now)

- Mac/Linux parity timing — defer until Windows MVP is shipped.
- SaaS pricing layer (hybrid backend) — only revisit if Phase 3 user feedback demands sync.
- Mobile companion (read-only timeline viewer) — out of scope.
