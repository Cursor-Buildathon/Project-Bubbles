# Bubbles — POC + Phased Advancement Plan

## Context

Bubbles is a 2D pixel-art desktop pet that doubles as a personal multi-agent AI workstation. Same avatar, transformed (sprite skin, voice, personality, tools) per active agent. Each agent is defined by `skills.md` + config + assets, with persistent local memory and a permission-gated safety layer.

This document covers two things:
- **PART A** — the **5-week POC** built by 2 devs with AI-driven development. Now updated with **Foundation Enablers** that cost almost nothing during POC but unblock V1/V2 work.
- **PART B** — the **phase-by-phase roadmap** to evolve the POC into the full agentic application (V1 → V2 → V3).

**Stack (unchanged across all phases)**: Electron + React + TypeScript + Vite, PixiJS for sprites, SQLite (better-sqlite3) [+ sqlite-vec from V1], MiniMax for all AI (M2.7 chat, Speech-02 TTS, voice cloning, image gen), local-only runtime (no backend).

---

# PART A — POC (5 weeks, 2 devs)

## A.1 Goal

A shippable POC that a stranger can install and immediately recognise as "the desktop pet that becomes any AI agent." Definition of Done lives at the bottom of Part A.

## A.2 Scope

### IN

1. Pixel-art desktop pet — transparent always-on-top window, draggable, click-through outside sprite alpha, animations: idle, blink, talk, think (extensible — see Foundation Enabler #6).
2. **3 preset agents** (`Bubbles`, `Coda`, `Sage`) — each with own sprite skin, MiniMax voice ID, and `skills.md`.
3. Agent switcher — sprite + voice + system prompt all swap.
4. Mini chat panel anchored to avatar; streaming text + speech bubble.
5. MiniMax M2.7 streaming chat with function calling.
6. MiniMax Speech-02-Turbo TTS with lip-sync to amplitude.
7. **2 built-in tools** (`read_file`, `write_file`) behind a Tool interface (see Foundation Enabler #1).
8. SQLite memory: conversations, messages, agent_notes (schema includes V1 headroom — Foundation Enabler #2).
9. First-run wizard: capture MiniMax API key (Electron `safeStorage`) + pick a project folder.

### OUT (deferred to Part B)

Agent Birth System, MCP client, voice cloning, vector embeddings, multi-agent collaboration, Memory Timeline UI, self-improvement, STT, AI-generated sprite pipeline, Mac/Linux, auto-update.

## A.3 Foundation Enablers (NEW — added to POC core)

These are small architectural choices that cost minimal POC time but **save weeks during V1/V2**. Treat them as load-bearing.

| # | Enabler | Cost in POC | Saves later |
|---|---|---|---|
| 1 | **Tool interface + registry** — `read_file`/`write_file` implement a `Tool` interface with `{name, schema, invoke, requiresApproval}`. Registry resolves by name. | ~1 day | V1 MCP integration is a 1-day swap, not a refactor |
| 2 | **Memory schema headroom** — include `projects`, `timeline_events`, `permissions` tables and an `embedding BLOB NULL` column on memories from day one. UI ignores them in POC. | ~2h | Zero migrations needed for V1/V2 memory features |
| 3 | **Agent registry from filesystem** — store presets as `~/.bubbles/agents/<id>/{config.json, skills.md, sprites/}`, not hardcoded constants. Birth System later just writes more directories. | ~half day | Agent Birth System ships in days, not weeks |
| 4 | **Permission decision logging** — every tool call logs to `permissions(tool_name, payload_hash, decision, decided_at)` even if POC always prompts. | ~1h | "Remember choice" feature in V1 is a UI-only change |
| 5 | **Cost meter from day one** — every MiniMax call writes a row to `cost_events(capability, input_tokens, output_tokens, cost_usd, at)`. | ~2h | Spend dashboards just need a chart |
| 6 | **Animation extensibility** — sprite engine accepts any animation name with `idle` fallback. Mood enum is open-ended (`type Mood = string`), not a fixed union. | ~1h | New moods (researching, planning, celebrating) are JSON-only changes |
| 7 | **Voice ID per agent (no hardcoded voices)** — `agent.voiceId: string` drives every TTS call. POC uses 3 stock IDs; voice cloning later just changes the value. | already free | Voice cloning is a Settings change, not a code change |
| 8 | **Versioned IPC channels** (`v1:agent:run`, `v1:tool:invoke`) | ~1h | V2 channels can land alongside without breaking renderer |
| 9 | **AbortController on AgentLoop from day one** | ~2h | Cancellable agents + multi-agent killswitch already work |
| 10 | **Structured logger** (`pino`) with correlation IDs (turnId on every log) | ~2h | Multi-agent debugging in V2 is feasible |
| 11 | **`skills.md` compiler is real, not a stub** — even with 3 hardcoded agents, parse via the same compiler V1/V2 will use | ~half day | Agent Birth output is consumed by the same code path |
| 12 | **Streaming tool-call protocol** — handle `finish_reason=tool_calls` correctly even though only 2 tools exist | already in plan | MCP tools just plug in |

Total foundation cost: **~3 dev-days across 5 weeks**, paid back many times over.

## A.4 Two-Developer Split

Shared contract between devs is `packages/shared-types` (zod schemas + TS types).

### Dev A — "Frontend / Pet"
Electron windows (transparent + alpha hit-test + tray), PixiJS sprite engine, Aseprite loader, **3 hand-drawn skins** (Bubbles/Coda/Sage × 4 anims), mood controller (open-ended — Enabler #6), chat panel, agent switcher, **permission preview modal** (Monaco diff), first-run wizard.

### Dev B — "Brain / Runtime"
Main process + typed IPC bridge (zod), `minimax-client` (M2.7 streaming + Speech-02-Turbo), `agent-runtime` (AgentLoop + AbortController + skills compiler — Enablers #9, #11), `memory-core` (SQLite + DAOs with V1 headroom — Enabler #2), `tool-kit` (Tool interface + 2 tools — Enabler #1), `permission-guard` (logging — Enabler #4), `cost-meter` (Enabler #5), audio playback + lip-sync events.

### Shared (pair)
`shared-types`, repo scaffold + Turborepo + CI, `CLAUDE.md` per package + `.cursorrules`, `pino` logger setup (Enabler #10).

## A.5 AI-Driven Development Workflow

Treat Cursor + Claude + Composer as a third developer.

**Repo conventions for AI-friendliness**
- Files < 250 lines (AI accuracy degrades with size).
- Co-located tests (`Foo.ts` ↔ `Foo.test.ts`).
- **Zod-first contracts** — every IPC channel, MiniMax payload, agent shape has a zod schema. AI generates correct types automatically.
- Section markers (`// #region`) so Composer can target edits in long files.

**`CLAUDE.md` per package** — biggest lever for AI quality. Each one states: purpose, public exports, invariants, forbidden patterns, how to run tests.

**`.cursorrules`** — stack versions, naming, error style, "test first," pointer to package-local CLAUDE.md.

**Composer** for cross-cutting changes (new IPC channel, new tool, new agent preset). **Cursor single-file** for everything else — Composer drift is real on small changes.

**Daily rhythm**: PR includes one-line "AI prompt log." Pair on IPC schema first thing each morning if it changed.

## A.6 AI-Driven Testing

Three layers, mostly generated/maintained by Claude.

1. **Unit (Vitest)** — Dev writes signature + 1 example; Claude generates the rest from JSDoc + types. Target 70% on `packages/*`.
2. **E2E (Playwright + Electron)** — `tests/e2e/scenarios.md` lists user journeys in plain English; Claude converts to specs.
3. **LLM-as-Judge for agent quality** — `tests/agent-eval/dataset.jsonl` with ~30 prompts/agent + rubric criteria. `pnpm eval` runs through real loop, **second M2.7 call judges** 1–5 + reason. Nightly CI; fail if avg drops > 0.5 vs. last green. ~$0.50/run.
4. **Visual regression** — Playwright snapshots of avatar at 4 moods × 3 agents (12 images). Pixel-diff on PR.

## A.7 5-Week Timeline

| Week | Dev A (Frontend) | Dev B (Brain) | Joint |
|---|---|---|---|
| 1 | Electron transparent window, alpha hit-test, tray | IPC bridge, M2.7 chat client (non-streaming) | Repo, `shared-types`, CLAUDE.md, `.cursorrules`, CI, **Foundation Enablers #2, #4, #8, #10** |
| 2 | PixiJS engine + Aseprite loader; Bubbles base sprite × 4 anims; **Enabler #6 mood extensibility** | M2.7 streaming + Speech-02-Turbo; SQLite schema + DAOs; **Enablers #5 cost meter, #11 skills compiler** | First "type → text reply" wired |
| 3 | Speech bubble + lip-sync; Coda + Sage sprites; **Enabler #3 filesystem-loaded agent presets** | AgentLoop + AbortController + 3 preset agents; **Enabler #9** | First "type → spoken reply with lip-sync" |
| 4 | Agent switcher; permission preview modal | `read_file`/`write_file` behind Tool interface + permission gate; **Enabler #1** | Wire permission flow end-to-end |
| 5 | First-run wizard, polish, packaging icon | Hardening, error states, retry/backoff | E2E suite, agent-eval rubric, Windows installer, demo recording |

No buffer built in — eval harness and packaging are the natural compressible items.

## A.8 POC File Structure

```
bubbles/
├── apps/
│   ├── desktop/                 # Electron main + preload
│   └── renderer/                # React UI
│       ├── src/avatar/          # PixiJS, mood controller (extensible)
│       ├── src/chat/            # panel, speech bubble
│       ├── src/agents/          # switcher
│       └── src/permission/      # diff modal
├── packages/
│   ├── shared-types/            # zod IPC + agent + message schemas
│   ├── agent-runtime/           # AgentLoop + AbortController + SkillsCompiler
│   ├── memory-core/             # SQLite + DAOs (with V1 headroom)
│   ├── minimax-client/          # M2.7 + Speech-02-Turbo
│   ├── tool-kit/                # Tool interface + 2 tools (registry-ready)
│   ├── permission-guard/        # decision logging
│   └── cost-meter/              # MiniMax usage tracking
├── assets/sprites/              # 3 hand-drawn skins
├── tests/e2e/, tests/agent-eval/
├── CLAUDE.md, .cursorrules
└── package.json (pnpm + Turborepo)
```

## A.9 POC Definition of Done

A stranger can:
1. Install the Windows installer (< 200 MB).
2. Enter MiniMax API key in first-run wizard.
3. See Bubbles appear on their desktop.
4. Type "hi" → spoken, lip-synced reply within 2 s of first token.
5. Switch to Coda; ask "make hello.txt with my name" → see permission preview → approve → file on disk.
6. Switch to Sage; get a thoughtful reply in Sage's voice.
7. Quit, relaunch, see prior conversation.

Verification: `pnpm dev` < 3s launch • `pnpm test` green, ≥ 70% coverage • `pnpm e2e` 5/5 pass • `pnpm eval` ≥ 4.0/5 avg • `pnpm package:win` produces signed `.exe` • 2-min demo recording.

---

# PART B — Post-POC Phased Roadmap

POC ships at end of Week 5. Each phase below is **independently shippable** — you can stop at any one and still have a coherent product.

## B.1 Phase V1 — Personal Agent Workshop (Weeks 6–12, 7 weeks)

**Theme**: "Let users create their own agents and give them real tools." Turns the 3-preset POC into an extensible workshop.

### V1 capabilities

1. **MCP client integration** — agents can use the entire MCP ecosystem
2. **Agent Birth System** — create agents from a description in minutes
3. **Vector memory** — semantic recall across conversations
4. **Voice cloning** — unique voice per agent from a 10s sample
5. **Project concept** — switch active project, scope tools per project

### V1 phase plan

#### V1.1 — MCP Bridge (Weeks 6–7)
- `packages/mcp-bridge` using `@modelcontextprotocol/sdk`
- Replace direct `tool-kit` functions with MCP server processes (filesystem, web_search, code_runner, plan_mode)
- Settings → Tools UI: install/configure community MCP servers (drop-in `command`/`args`/`env`)
- Per-agent `toolWhitelist` from `skills.md` frontmatter (compiler already exists from POC — Enabler #11)
- 30s timeout per tool call; auto-restart on crash; fallback UI

**Foundation paid back**: Enabler #1 means swapping the Tool interface to MCP-backed implementations is a 1-day change.

#### V1.2 — Vector Memory (Weeks 7–8, parallel with V1.1)
- Add `sqlite-vec` virtual table (`memories_vec(rowid, embedding)`)
- `minimax-client/embeddings.ts` — wraps MiniMax embeddings (or local `bge-small` fallback for offline)
- Recall pipeline in `memory-core/recall.ts`: embed query → kNN top-20 → re-rank via M2.7-highspeed → top 5
- Backfill embeddings for all existing messages (batch job on first launch after upgrade)
- Memory kinds enabled: `agent`, `project`, `conversation`, `file`, `relationship`

**Foundation paid back**: Enabler #2 — `embedding BLOB NULL` already exists.

#### V1.3 — Agent Birth System (Weeks 8–10)
- Birth wizard window: 1–3 sentence description input → preview → confirm
- M2.7 chain: description → JSON `{name, role, persona, tools, rules, skills_md}`
- Sprite variant pipeline (`scripts/gen-agent-sprite.ts`):
  1. MiniMax image API: "recolor 64×64 pixel-art creature with [palette + accessory]"
  2. Pillow / sharp quantize to fixed palette
  3. Composite onto base atlas → Aseprite-compatible JSON
- Voice cloning: 10s recording UI → MiniMax voice clone API → store `voiceId` on agent
- Birth animation: Bubbles plays `celebrate` → "Meet [name]!"

**Foundation paid back**: Enabler #3 (filesystem-loaded agents) means the wizard just writes a directory.

#### V1.4 — Project Concept (Weeks 10–11)
- `projects` table populated (already exists — Enabler #2); switcher UI
- Filesystem MCP scoped to `projects.root_path` per active project
- Per-project agent scoping: agents marked `memory_scope: project` only see that project's memory
- File watcher updates `files` table on changes outside Bubbles

#### V1.5 — Hardening + V1 Ship (Weeks 11–12)
- Auto-update channel (`electron-updater` + GitHub Releases)
- Crash reporting (Sentry, opt-in)
- "Remember choice" permission UI (data already logged — Enabler #4)
- Spend dashboard (data already logged — Enabler #5)
- V1 release + demo

### V1 Definition of Done
- User can describe an agent in one sentence and have it appear with a unique sprite + voice within 60s.
- Agents can use any MCP server (verified with `github` MCP, `postgres` MCP).
- Asking an agent something from 2 weeks ago → it recalls semantically.
- Switching projects scopes all tools + memory correctly.

---

## B.2 Phase V2 — The Agent World (Weeks 13–20, 8 weeks)

**Theme**: "Agents collaborate, remember everything, and improve themselves."

### V2 capabilities

1. **Coordinator + multi-agent collaboration**
2. **Memory Timeline UI** with audio replay
3. **Self-improvement loop** — agents learn from feedback
4. **Voice input (STT)** — talk to Bubbles
5. **Relationship memory graph**

### V2 phase plan

#### V2.1 — Memory Timeline (Weeks 13–14)
- Timeline view (`timeline_events` already populated since POC — Enabler #2)
- Day/hour grouping; filter by agent/project/event-kind
- Audio replay of key turns via Speech-02-HD
- "Jump to context" — clicking a timeline event opens the originating conversation

#### V2.2 — Coordinator + Multi-agent (Weeks 14–17)
- Bubbles (the avatar) is itself the Coordinator agent
- New built-in tool: `delegate(agentName, subtask)` → spawns child `AgentLoop` (AbortController already supports it — Enabler #9)
- Concurrency cap (default 3 parallel) to control MiniMax spend
- In-process message bus for inter-agent communication
- Synthesis step: Coordinator merges child results into final response
- Conversation tree visualisation (DAG view) on the avatar's chat panel
- All sub-agent activity logged with correlation IDs (Enabler #10) so you can debug who did what

#### V2.3 — Self-Improvement Loop (Weeks 17–18)
- User feedback capture: thumbs in chat, free-text "be more direct" comments
- `SkillsImprover` background task: M2.7 proposes diff to `skills.md` based on accumulated feedback
- Diff shown via existing permission modal → approve → write file + bump version + log `timeline_events(kind='agent_improved')`
- Per-agent "improvement history" view

#### V2.4 — Voice Input / STT (Weeks 18–19)
- `nodejs-whisper` (Whisper-cpp) for local STT — privacy-friendly, offline
- Push-to-talk hotkey (default `Ctrl+\``)
- Voice activity detection for hands-free mode
- Migrate to MiniMax STT once available

#### V2.5 — Polish + Public Launch (Weeks 19–20)
- Relationship memory: graph view of agent ↔ project ↔ file ↔ decision
- Optional Hailuo "agent intro reels" on birth (10s video)
- Mac build (Electron handles most; sign + notarize)
- Linux AppImage (best-effort)
- Public landing page, docs site, V2 launch

### V2 Definition of Done
- "Build me a project pitch about X" → Coordinator spawns research + writing + design agents in parallel; final result delivered with timeline showing the tree.
- Thumbs-down "too verbose" → SkillsImprover proposes diff → approve → next conversation reflects change.
- Push-to-talk → spoken question → spoken reply.
- Memory Timeline shows last 30 days of activity, filterable, replay-able.

---

## B.3 Phase V3 — Beyond the Original Spec (Weeks 21+)

**Theme**: "Bubbles becomes a platform." Optional, market-driven.

### Candidate V3 features (pick based on user feedback after V2 launch)

| Feature | What it adds | Cost |
|---|---|---|
| **Cloud sync (opt-in)** | Multi-device — same agents/memory on laptop + desktop. Thin backend (Cloudflare Workers + D1 + R2). Privacy-preserving via E2E encryption of memory blobs. | 4–6 weeks |
| **Agent marketplace** | Users publish/install agents (config + skills.md + sprite). Signature verification, content moderation. | 6–8 weeks |
| **Mobile companion** (read-only) | iOS/Android app: Memory Timeline view, push notifications when agents finish long tasks. | 4 weeks |
| **Team workspaces** | Shared projects + shared agents across a small team. Requires hybrid backend. | 8–10 weeks |
| **Live2D upgrade path** | For users who want richer, non-pixel avatars. Sprite engine → swap-in Live2D renderer. | 3 weeks |
| **Browser extension** | Bubbles peeks at the active browser tab as context (with explicit permission). | 2 weeks |
| **Plugin SDK** | Public SDK to build third-party tools (just MCP servers + a Bubbles manifest). | 2 weeks (if MCP is solid) |

V3 is shaped by V2 launch metrics — there's no point committing now.

---

## B.4 Cross-Phase Practices

These hold from POC through V3.

### AI-driven dev — scaling up
- Per-package `CLAUDE.md` is **mandatory** for every new package. Reject PRs that add a package without one.
- `.cursorrules` revisited every phase boundary.
- "AI prompt log" in PR descriptions becomes a tag (`ai-pair`, `ai-solo`, `human-only`) for retrospective analysis.
- Composer reserved for cross-cutting changes; default to single-file Cursor edits.

### AI-driven testing — scaling up
- LLM-as-judge dataset grows by ≥ 10 prompts per shipped feature.
- Every new agent capability needs a rubric criterion (e.g. *"Coordinator must not delegate to itself"*).
- Visual regression scope expands per phase: V1 adds birth wizard frames, V2 adds timeline + DAG views.
- Nightly eval cost stays < $5/run by sampling (run full set weekly, sample of 30 prompts nightly).

### Architecture invariants (don't break these)
- All AI calls go through `minimax-client`. No `fetch('api.minimax.io')` elsewhere.
- All file writes go through `permission-guard`. No `fs.writeFile` outside it.
- All agent state lives in `memory-core`. No ad-hoc JSON files.
- Renderer never imports Node modules. IPC only.
- IPC is zod-validated on both sides.

### Versioning + migrations
- DB migrations versioned in `memory-core/migrations/` from day one.
- IPC channels versioned (Enabler #8); deprecate old channels gracefully.
- `skills.md` has a `version` field; SkillsCompiler handles all versions.

### Cost ceilings
- Daily MiniMax spend cap (Settings, default $5/day POC, $20/day V1+).
- Per-agent token budget (configurable in `skills.md` frontmatter).
- Spend dashboard shows last 7/30 days by capability.

---

## B.5 Risk Register (Cross-Phase)

| Risk | Mitigation | First seen |
|---|---|---|
| MiniMax API latency makes voice feel laggy | Speech-02-Turbo + sentence-level pre-buffering | POC |
| Pixel art blurry at HiDPI | Author at 64×64, integer-scale, `roundPixels:true`, nearest-neighbour | POC |
| Tool calls wreck filesystem | Hard-scope to project root; mandatory diff preview | POC |
| Context > 228k window | Auto-summarise oldest 30% into `conversations.summary` | V1 |
| MiniMax key on disk leak | `safeStorage` (DPAPI on Windows); never log; redact telemetry | POC |
| MCP server crashes hang loop | 30s timeout; auto-restart; fallback UI | V1 |
| Multi-agent spend explosion | Concurrency cap; daily ceiling; cost dashboard | V2 |
| Voice cloning misuse | Explicit consent checkbox + stored flag | V1 |
| Self-improvement makes agent worse | Diff preview mandatory; `version` rollback in `skills.md` | V2 |
| AI-generated tests rot silently | Human-review diffs on regenerated specs; weekly "test audit" PR | All phases |

---

## B.6 Critical Files Created Per Phase

### POC
`packages/shared-types/src/{ipc,agent,message}.ts` • `packages/agent-runtime/src/{AgentLoop,SkillsCompiler}.ts` • `packages/memory-core/src/{schema.sql,dao.ts}` • `packages/minimax-client/src/{chat,tts}.ts` • `packages/tool-kit/src/{Tool.ts,readFile.ts,writeFile.ts,registry.ts}` • `packages/permission-guard/src/Guard.ts` • `packages/cost-meter/src/index.ts` • `apps/desktop/src/main/index.ts` • `apps/renderer/src/avatar/SpriteEngine.ts` • `CLAUDE.md` (root + per package) • `.cursorrules`

### V1
`packages/mcp-bridge/src/client.ts` • `packages/minimax-client/src/{embeddings,voiceClone,image}.ts` • `packages/memory-core/src/recall.ts` • `apps/renderer/src/agents/BirthWizard.tsx` • `scripts/gen-agent-sprite.ts` • `apps/renderer/src/projects/Switcher.tsx`

### V2
`packages/agent-runtime/src/Coordinator.ts` • `apps/renderer/src/timeline/TimelineView.tsx` • `apps/renderer/src/agents/ConversationTree.tsx` • `packages/agent-runtime/src/SkillsImprover.ts` • `packages/voice-input/src/whisper.ts` • `apps/renderer/src/memory/RelationshipGraph.tsx`

---

## B.7 Verification Per Phase

### POC (see A.9)
5/5 E2E scenarios • LLM-judge ≥ 4.0/5 • Windows installer • 2-min demo.

### V1
- Birth Bubbles "Calypso the calm" in < 60s end-to-end (form → sprite → voice → first reply).
- Install community `github` MCP server via Settings → create an issue with permission preview.
- Tell agent a fact in conversation A, ask 2 weeks later in B → semantic hit logged.
- Switch project → filesystem MCP scope changes verified (denied write outside root).
- LLM-judge ≥ 4.2/5 on expanded 200-prompt set.

### V2
- "Build me a project pitch about X" → Coordinator delegates to ≥ 2 sub-agents; tree rendered; result synthesised.
- Thumbs-down feedback × 3 → SkillsImprover proposes diff → approve → behaviour change measurable in next eval run.
- Push-to-talk → spoken reply within 3s.
- Timeline shows ≥ 30 days; audio replay works for any turn.
- LLM-judge ≥ 4.3/5 on 300-prompt set with multi-agent rubrics.

### V3
Defined per chosen feature post-launch.

---

## B.8 Phase Gates (Don't Start Next Phase Until…)

**POC → V1**: All 7 Definition-of-Done items pass on a clean Windows 11 install. 5+ external testers ran the demo.

**V1 → V2**: 50+ users created custom agents. Crash rate < 1%. Avg cost-per-active-day < $1. LLM-judge stable ≥ 4.2/5 over 2 consecutive nightly runs.

**V2 → V3**: 500+ active users. Public reviews / feedback collected. Clear top-3 feature requests inform V3 selection.
