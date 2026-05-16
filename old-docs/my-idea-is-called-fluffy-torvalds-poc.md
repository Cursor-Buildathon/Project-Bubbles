# Bubbles — POC / MVP Plan (2 Devs, AI-Driven)

## Context

Pared-down build of the full Bubbles vision. Goal: a **shippable Proof-of-Concept in 5 weeks** that a stranger can install and immediately recognise as "the desktop pet that becomes any AI agent." Everything cut from this document is intentionally deferred — the full plan still exists as the V1/V2 roadmap.

**Team**: 2 developers, AI-driven (Cursor IDE + Claude as pair-programmer + Composer for multi-file scaffolds).
**Timeline**: 5 calendar weeks.
**Stack** (locked, unchanged from full plan): Electron + React + TypeScript + Vite, PixiJS for sprites, SQLite (better-sqlite3), MiniMax for all AI, local-only runtime.

---

## POC Scope — What's IN, What's OUT

### IN (must work end-to-end)

1. **Pixel-art desktop pet** — transparent always-on-top window, draggable, click-through outside sprite, 4 animations (idle, blink, talk, think).
2. **3 preset agents** hand-authored: `Bubbles` (general), `Coda` (coding), `Sage` (research). Each has its own sprite skin, voice, and `skills.md`.
3. **Agent switcher** — small UI to flip between the 3; sprite + voice + system-prompt all swap.
4. **Mini chat panel** anchored to the avatar; streaming text + speech bubble.
5. **MiniMax M2.7 chat** with function calling + streaming.
6. **MiniMax Speech-02-Turbo TTS** for spoken replies + lip-sync to amplitude.
7. **2 built-in tools** (no MCP layer yet, just direct functions):
   - `read_file(path)` — auto-allowed inside project root
   - `write_file(path, content)` — gated by permission preview (diff modal)
8. **Basic memory**: SQLite stores conversations, messages, and per-agent persistent notes. **No embeddings yet** — keyword/recency recall only.
9. **First-run wizard**: capture MiniMax API key (Electron `safeStorage`) + pick a project folder.

### OUT (deferred to V1/V2)

- Agent Birth System (creating new agents on the fly)
- MCP client / external MCP servers
- Voice cloning (use 3 stock MiniMax voice IDs)
- Vector embeddings + semantic recall
- Multi-agent collaboration / Coordinator
- Memory Timeline UI
- Self-improvement loop (skills.md auto-edit)
- STT (voice input)
- AI-generated sprite pipeline (use 3 hand-drawn skins)
- Mac/Linux builds
- Auto-update channel

---

## Two-Developer Split

Designed so the two devs work in parallel with minimal merge friction. The **shared contract** between them is `packages/shared-types` (zod schemas + TS types for IPC, agent, memory).

### Dev A — "Frontend / Pet"
Owns everything the user sees and the avatar's behaviour.

- Electron window setup (transparent, always-on-top, alpha hit-test, multi-monitor)
- PixiJS sprite engine + Aseprite JSON loader
- Hand-drawn 3 sprite skins (Bubbles/Coda/Sage) — base + 4 animations each
- Mood controller: maps agent state (`idle | listening | thinking | talking`) → animations
- Chat panel UI (React + Tailwind): streaming text, speech bubble, attach-file button
- Agent switcher dropdown
- Permission preview modal (Monaco diff viewer)
- First-run wizard
- System tray icon

### Dev B — "Brain / Runtime"
Owns Node-side logic, AI calls, persistence.

- Main process bootstrap + typed IPC bridge (zod-validated)
- `minimax-client`: M2.7 streaming chat with tool calls + Speech-02-Turbo TTS
- `agent-runtime`: AgentLoop (ReAct), preset loader, skills.md → system prompt compiler
- `memory-core`: SQLite schema + DAOs (conversations, messages, agent_notes)
- 2 built-in tools (`read_file`, `write_file`) + permission gate
- Cost meter (token + character usage in DB)
- Audio playback (`node-speaker` + lip-sync amplitude events)

### Shared (pair on these)
- `packages/shared-types` — IPC schema, agent shape, message shape (zod)
- Repository scaffold + Turborepo config + CI
- `CLAUDE.md` / `.cursorrules` files (the AI-driven-dev contract — see below)

---

## AI-Driven Development Workflow

The team will move faster by treating Cursor + Claude + Composer as a **third virtual developer**. The repo is structured to maximise AI usefulness.

### Repo conventions for AI-friendliness

- **Small files** (< 250 lines). AI accuracy degrades with file size — prefer many small modules over a few big ones.
- **Co-located tests**: `Foo.ts` next to `Foo.test.ts`. Lets AI see code + tests in one read.
- **Zod-first contracts**: every IPC channel, MiniMax payload, and agent shape has a zod schema. AI generates correct types automatically.
- **Section-marked files**: long files use `// #region <name>` / `// #endregion` so Composer can target edits.
- **JSDoc on public APIs only** — internal code stays comment-light.

### `CLAUDE.md` (root + per-package)

Each package gets a short `CLAUDE.md` that tells Claude/Cursor:

- The package's purpose in one sentence
- Public exports (what the rest of the repo may import)
- Key invariants (e.g. *"all DB writes go through `memory-core/dao` — never raw sql elsewhere"*)
- Forbidden patterns (e.g. *"no `any`, no `console.log` in main process — use `logger`"*)
- How to run that package's tests

This is the single biggest lever for AI-driven dev quality.

### `.cursorrules` (Cursor IDE)

Project-wide rules covering: stack versions, naming, error-handling style, "always write the test first," and a pointer to the package-local `CLAUDE.md`.

### Composer usage patterns

Composer (multi-file edit) is the right tool for:
- Adding a new IPC channel (touches preload bridge + main handler + renderer hook + zod schema in one shot)
- Adding a new built-in tool (touches `tool-kit/<tool>.ts` + permission policy + tool registry)
- Adding a new agent preset (touches `agents/<id>/skills.md` + sprite assets + registry)

Use single-file Cursor edits for everything else — Composer drift is real on small changes.

### Daily rhythm

- Each PR includes a one-line "AI prompt log" in the description (what prompts were used). Cheap, helps debug regressions later.
- Pair on the IPC schema first thing each morning if it changed — both devs need an aligned mental model before AI can help safely.

---

## AI-Driven Testing

Tests are mostly **generated and maintained by Claude/Cursor**, with humans reviewing for intent. Three layers:

### 1. Unit (Vitest, AI-generated)

- Workflow: dev writes the function signature + one example test → asks Claude in Cursor to generate the rest of the suite from the JSDoc + types.
- Coverage target: **70%** on `packages/*` (don't chase 100% — diminishing returns).
- AI generates edge cases the dev would forget (empty strings, unicode, null tool_calls).

### 2. E2E (Playwright + Electron, AI-scripted)

- A `tests/e2e/scenarios.md` file lists user journeys in plain English (5 scenarios for POC):
  1. First-run wizard → API key saved → avatar appears
  2. Type "hello" → spoken reply + lip-sync within 2s
  3. Switch from Bubbles to Coda → sprite + voice both change
  4. Coda asked to write a file → permission modal → approve → file on disk
  5. Quit + relaunch → last conversation visible
- Claude converts each scenario into a Playwright spec. Re-generated whenever the UI changes — humans review the diff.

### 3. LLM-as-Judge for agent quality

The hardest thing to test in agentic apps is *"did the agent give a good answer?"* — not just *"did it return text?"*. POC adds a tiny eval harness:

- `tests/agent-eval/dataset.jsonl` — ~30 hand-curated prompts per agent (90 total) with rubric criteria (e.g. *"Coda must propose a code change OR ask a clarifying question; never both"*).
- A `pnpm eval` script runs each prompt through the real agent loop, then a **second MiniMax M2.7 call acts as judge** scoring the response against the rubric (1–5 + reason).
- Run nightly in CI; fail build if average score drops > 0.5 vs. last green run.
- Cheap (~$0.50/run) and catches regressions that unit tests can't.

### 4. Visual regression (lightweight)

- Playwright snapshots of the avatar window at 4 mood states per agent (12 images total).
- Pixel-diff on PR; a human reviews any diff before merge.

### Test gates on PRs

- `pnpm typecheck && pnpm test && pnpm e2e` must be green.
- LLM-as-judge runs nightly only (too slow for per-PR).
- Coverage report posted as PR comment by GitHub Action.

---

## File Structure (POC subset)

```
bubbles/
├── apps/
│   ├── desktop/                 # Electron main + preload (Dev A owns shell, Dev B owns IPC handlers)
│   └── renderer/                # React UI (Dev A)
│       ├── src/avatar/          # PixiJS engine, mood controller
│       ├── src/chat/            # panel, speech bubble
│       ├── src/agents/          # switcher
│       └── src/permission/      # diff modal
├── packages/
│   ├── shared-types/            # zod IPC + agent + message schemas (PAIR)
│   ├── agent-runtime/           # AgentLoop, preset loader, skills compiler (Dev B)
│   ├── memory-core/             # SQLite + DAOs (Dev B)
│   ├── minimax-client/          # M2.7 chat + Speech-02-Turbo (Dev B)
│   └── tool-kit/                # read_file, write_file + permission policy (Dev B)
├── assets/sprites/              # 3 hand-drawn skins (Dev A)
├── tests/
│   ├── e2e/                     # Playwright + scenarios.md
│   └── agent-eval/              # rubric dataset + judge harness
├── CLAUDE.md                    # root AI-dev rules
├── .cursorrules
└── package.json (pnpm workspaces + Turborepo)
```

---

## 5-Week Timeline

| Week | Dev A (Frontend / Pet) | Dev B (Brain / Runtime) | Joint |
|---|---|---|---|
| **1** | Electron transparent window, alpha hit-test, system tray | IPC bridge, MiniMax M2.7 chat client (no streaming yet) | Repo scaffold, `shared-types`, CLAUDE.md, `.cursorrules`, CI |
| **2** | PixiJS engine + Aseprite loader; Bubbles base sprite + 4 anims | M2.7 streaming + Speech-02-Turbo TTS; SQLite schema + DAOs | First end-to-end "type → text reply" wired |
| **3** | Speech bubble + lip-sync hook; Coda + Sage sprites | AgentLoop + skills.md compiler + 3 preset agents | First end-to-end "type → spoken reply with lip-sync" |
| **4** | Agent switcher UI; permission preview modal (Monaco diff) | `read_file` + `write_file` tools + permission gate; cost meter | Wire permission flow end-to-end |
| **5** | First-run wizard, polish, packaging icon | Hardening, error states, retry/backoff | E2E suite, agent-eval rubric, Windows installer build, demo recording |

**Buffer**: there is none built in — the LLM-as-judge eval and packaging in Week 5 are the natural compressible items if a week slips.

---

## Critical Files to Create First (Week 1)

| Path | Owner | Why first |
|---|---|---|
| `packages/shared-types/src/ipc.ts` | Pair | Unblocks both devs |
| `packages/shared-types/src/agent.ts` | Pair | Defines agent shape used everywhere |
| `CLAUDE.md` (root + per-package) | Pair | AI-dev quality multiplier |
| `apps/desktop/src/main/index.ts` | A | Electron entry |
| `apps/desktop/src/preload/bridge.ts` | A+B | IPC surface |
| `packages/minimax-client/src/chat.ts` | B | Earliest dependency |
| `packages/memory-core/src/schema.sql` | B | Locks DB shape |

---

## MiniMax Usage in POC

| Capability | Endpoint | Used for |
|---|---|---|
| Chat + tool calls | M2.7 streaming | All agent reasoning |
| TTS | Speech-02-Turbo | Spoken replies (low latency) |
| ~~Voice cloning~~ | — | Deferred; use 3 preset voice IDs |
| ~~Image gen~~ | — | Deferred; sprites hand-authored |
| ~~Embeddings~~ | — | Deferred; keyword/recency recall only |

A daily cost ceiling lives in Settings (default $5/day) — when hit, agents reply *"I've hit today's spend cap"* instead of calling out. Prevents demo-day surprises.

---

## Definition of Done (POC)

A stranger can:

1. Download the Windows installer (< 200 MB).
2. Enter their MiniMax API key in the first-run wizard.
3. See Bubbles appear on their desktop.
4. Type "hi" — get a spoken, lip-synced reply within 2 seconds of first token.
5. Switch to Coda; ask "make me a hello.txt with my name" — see the permission preview, approve, find the file on disk.
6. Switch to Sage; ask a research-flavoured question — get a thoughtful reply in Sage's voice.
7. Quit, relaunch, see prior conversation.

If all 7 work, the POC is done — proceed to V1 (Birth System, MCP, embeddings, voice clone) per the full plan.

---

## Verification (POC)

- `pnpm dev` — app launches in < 3s.
- `pnpm test` — green; coverage ≥ 70% on `packages/*`.
- `pnpm e2e` — all 5 scenarios pass on Windows.
- `pnpm eval` — average rubric score ≥ 4.0/5 across 90 prompts.
- `pnpm package:win` — produces signed `.exe` installer.
- Manual demo: record a 2-minute screen capture hitting all 7 Definition-of-Done steps.
