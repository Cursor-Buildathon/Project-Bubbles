# Bubbles v3 — Audit & Decision Log

> **Date:** 2026-05-16
> **Purpose:** Concise audit of Versions A (MiniMax CLI-Integrated) and B (Non-CLI), followed by a decision log for every feature carrying into v3.
> **Pair with:** [Change-Log.md](Change-Log.md) for architectural trade-off reasoning.

---

## 1. Version A — MiniMax CLI-Integrated Edition

### 1.1 What Worked

| Area | Why it worked |
|---|---|
| Two-window pet metaphor (avatar + workspace) | Clean separation; main process owns shared state; PixiJS sprite avatar with 9 mood states |
| Approval gating service | Single SQLite-backed safety choke-point; risk classifier auto-defaults new action types to `high`; voice + click resolution paths |
| FlowRouter + IntentClassifier | Deterministic regex classifier with no LLM cost; routes 11 task types reliably |
| Memory + Timeline stores | Local-first SQLite, redaction on open, deterministic schemas |
| Connector registry (fixture/MCP/HTTP) | Hybrid model with fixture fallbacks made CI/demos reliable when external services were unavailable |
| Universal `redactSecrets` pass | Defense-in-depth scrubbing applied at every persistence boundary |
| Landing-page sandbox concept (C7) | Path-checked, command-allowlisted, deterministic site IDs — the safety model is sound even though the execution path was fragile |
| Agent schema with hard-blocked visual fields | Prevented LLM-generated agents from mutating sprite appearance |

### 1.2 What Failed (and Root Causes)

| Failure | Root cause | v3 mitigation |
|---|---|---|
| **Voice STT** | Only IPC scaffolding shipped — no actual STT provider integrated. Web Speech API is unreliable on Electron Windows, browser-only on macOS. | Integrate Deepgram Nova-3 (real-time WS) as primary; OpenAI Whisper (`whisper-1`) as cloud fallback; bundled `whisper.cpp` (`ggml-base.en.bin`) for offline. See [Full-AI-Integrations-Plan.md §3](05-Full-AI-Integrations-Plan.md). |
| **TTS output** | macOS `say` binary only; `window.speechSynthesis` fallback flaky on Windows Electron. No cross-platform path. | ElevenLabs Turbo v2.5 (primary, streaming), OpenAI `tts-1-hd` (fallback), Piper (offline). All cross-platform. See [Full-AI-Integrations-Plan.md §4](05-Full-AI-Integrations-Plan.md). |
| **File read/write via CLI** | The `mmx` CLI was a single point of failure: install path resolution, ABI mismatches, regional auth errors, stalled-timeout false positives. | Eliminate the CLI entirely. All file I/O goes through main-process Node.js `fs/promises`, gated by the approval service. |
| **Image generation** | `mmx image generate --prompt` shelled out to the CLI; fixture mode wrote synthetic SVGs that masked the underlying breakage. | Replicate (`black-forest-labs/flux-1.1-pro`) primary, OpenAI `gpt-image-1` fallback. Direct HTTPS calls from main. |
| **Music generation** | Same CLI dependency; fixture mode emitted a hand-coded 440 Hz WAV that wasn't representative of real output. | Suno API (`suno-v4.5`) primary, Replicate (`meta/musicgen`) fallback. Direct HTTPS. |
| **Real Gmail/Calendar OAuth** | HTTP-MCP transport implemented but OAuth flow itself was unbundled — the user had to manually set env vars. | Drop email/calendar entirely from v3 scope (deferred to v4). Not in the required-capability list. |
| **Platform support** | macOS-only Keychain via `/usr/bin/security`; `say` binary; SafeStorage was wired but not used end-to-end. | Electron `safeStorage` (cross-platform, OS keychain-backed on macOS/Win/Linux) for all secrets. |
| **`sql.js` (WASM) persistence** | Every persist rewrites the entire DB blob. Slow at scale; doesn't survive crashes mid-write. | Switch to `better-sqlite3@12.x` (native, synchronous, WAL journaling). Already battle-tested in Version B. |

---

## 2. Version B — Non-CLI Edition

### 2.1 What Worked

| Area | Why it worked |
|---|---|
| `better-sqlite3` + WAL persistence | Sub-millisecond inserts; FK enforcement; crash-safe |
| Per-tool permission gate with diff preview | The modal showed a real left/right diff for `writeFile`, fetched via a `file:peek` IPC capped at 2 KB |
| Versioned IPC channels (`v1:*`) + Zod schemas | Every payload validated at the renderer↔main boundary; payload regex `/^v1:[a-z0-9:_-]+$/` enforced |
| `withTurnId` correlation logger | Every line in a turn shares a `turnId`; outbound MiniMax requests include `x-bubbles-turn-id` header |
| Test mode (`BUBBLES_TEST_MODE=1`) | Deterministic offline mode for CI, demos, screencasts |
| Filesystem-driven agent presets | `~/.bubbles/agents/<id>/{config.json, skills.md}` — diff-able, git-trackable |
| Cost meter with daily cap pre-gate | Hard refusal before any model call when the day's spend exceeds the cap |
| Skills compiler | Reads `skills.md` per turn (no restart needed) — supports live agent tuning |

### 2.2 What Failed (and Root Causes)

| Failure | Root cause | v3 mitigation |
|---|---|---|
| **UI rendering / deformity** | Likely PixiJS canvas DPR scaling mis-applied across HiDPI vs standard displays; transparent frameless avatar window had hit-test issues on Windows (no reliable click-through forwarding); chat panel positioning math didn't account for monitor scale factor changes. | Use `app.commandLine.appendSwitch('high-dpi-support', '1')` + `force-device-scale-factor`; explicit `devicePixelRatio` reads in PixiJS Application config; cross-platform window hit-test via `setIgnoreMouseEvents({forward:true})` validated on Win/Mac/Linux; canvas size driven by ResizeObserver, not by window.innerWidth. See [Full-Frontend-Plan.md §6](04-Full-Frontend-Plan.md). |
| **Voice commands** | Same as Version A — no STT provider was integrated. The IPC handler accepted "already-recognized text" that never arrived. | Same v3 mitigation as A: Deepgram primary, Whisper fallback. |
| **TTS** | Relied on the same MiniMax `Speech-02-Turbo` HTTPS path, but `HTMLAudioElement` + MP3 buffer playback was the bottleneck — failed audio frames on Windows Electron when Web Audio API was rate-limited. | ElevenLabs Turbo v2.5 streaming via WebSocket; render with `MediaSource` + chunked decoding; Piper local fallback. |
| **AlwaysAllow per-tool, not per-payload** | `permissions.payload_hash` column existed but was empty — a stale design intent. | v3: payload-scoped allow-list keyed by `tool_name + sha256(args)`. Old per-tool allow rows are migrated to expire on first use. |
| **Stale schema headroom** | `memories`, `files`, `decisions`, `timeline_events` tables existed without DAOs — confusing for new contributors. | Drop unused tables from initial migration; add them only when their DAO + IPC channel ships. |
| **`skills.md` parser fragility** | Hand-rolled — single-line frontmatter only, no block scalars, no comments. | Use `gray-matter` (battle-tested) for frontmatter + `marked` for body parsing. |
| **Voice ID hard-coded** | `male-qn-qingse` in `tts.ts`, despite `skills.md` declaring a per-agent voice. | v3 reads voice from agent config; abstraction layer maps it to provider-specific voice IDs (ElevenLabs `voice_id`, OpenAI voice name). |
| **No mic input (STT)** | Never implemented. Listed as roadmap. | First-class STT in v3 with three-tier fallback. |

---

## 3. Decision Log — Feature by Feature

Legend: **Kept** = forward as-is · **Rebuilt** = same goal, new implementation · **Dropped** = removed from scope.

| # | Feature | From | Decision | Reason |
|---|---|---|---|---|
| 1 | Floating pixel-art avatar window | A + B | **Kept** | Core product metaphor; both versions implemented it |
| 2 | PixiJS sprite animations with mood states | A + B | **Kept** | Worked in both; minor DPR fixes only |
| 3 | Chat panel docked to avatar | A + B | **Kept** | Worked; v3 fixes positioning edge cases |
| 4 | MiniMax CLI integration | A | **Dropped** | Single largest source of failure; eliminated per constraint |
| 5 | Direct MiniMax HTTPS API for LLM | A + B | **Dropped** | Replaced with Anthropic Claude as primary LLM; MiniMax becomes an optional fallback |
| 6 | macOS `say` binary for TTS | A | **Dropped** | Platform-specific; replaced with ElevenLabs |
| 7 | `window.speechSynthesis` TTS fallback | A + B | **Dropped** | Unreliable on Electron; replaced with Piper local |
| 8 | Web Speech API for STT | A | **Dropped** | Browser-only, unreliable; replaced with Deepgram |
| 9 | `sql.js` WASM persistence | A | **Dropped** | Whole-blob writes; replaced with `better-sqlite3` |
| 10 | `better-sqlite3` + WAL | B | **Kept** | Proven; cross-platform with prebuilt ABI binaries |
| 11 | Approval service with risk classifier | A | **Kept** | Excellent safety model; ported to better-sqlite3 |
| 12 | Voice approval resolver (approve/deny/cancel regex) | A | **Kept** | Cancel-first parsing prevents misclassification |
| 13 | FlowRouter + IntentClassifier (regex) | A | **Kept** | Zero-LLM-cost intent routing |
| 14 | Connector registry with fixture/MCP modes | A | **Rebuilt** | Drop MCP transport; keep fixture mode; add direct HTTPS adapters per service |
| 15 | Email/Calendar connectors (Gmail/Google Calendar) | A | **Dropped** | Not in required-capability list; OAuth never completed; defer to v4 |
| 16 | Web Search connector | A | **Rebuilt** | Drop MCP fallback path; primary becomes Tavily Search API, secondary Brave Search |
| 17 | Web search MCP transport | A | **Dropped** | MCP-style integrations replaced with direct provider SDKs |
| 18 | Local files tool (read/list) | A + B | **Kept** | Direct Node `fs`; workspace-scoped; rebuilt for v3 |
| 19 | File write tool with diff preview | B | **Kept** | Modal diff preview from Version B is excellent |
| 20 | Landing-page sandbox (C7) | A | **Rebuilt** | Keep sandbox model + path checks; replace `vite build` shell-out with programmatic `vite.build()` API call to remove a process boundary |
| 21 | Image generation | A | **Rebuilt** | Direct Replicate / OpenAI API; no CLI |
| 22 | Music generation | A | **Rebuilt** | Direct Suno / Replicate API; no CLI |
| 23 | Spend dashboard + daily cap pre-gate | B | **Kept** | Add per-provider cost tracking (multi-vendor in v3) |
| 24 | Memory store (SQLite) + extractor | A + B | **Kept** | Switched to better-sqlite3; LLM extractor moves to Claude Haiku |
| 25 | Timeline event log | A | **Kept** | Cross-references make sessions auditable |
| 26 | Affect detector (regex) | A | **Kept** | Deterministic baseline; v3 adds Hume EVI for richer emotion vectors |
| 27 | Emotional Interaction Layer (richer affect) | new | **Built** | Required capability #3; combines regex baseline + Hume EVI prosody for voice + sentiment for text |
| 28 | Spoken-response policy (≤280 chars/40 words) | A | **Kept** | Right-sized for spoken pace; v3 may tune per-affect |
| 29 | Agent Birth System (preview + approval → file create) | A | **Kept** | Required capability #9; "repair what is broken" — replace MiniMax JSON generation with Claude Sonnet structured output |
| 30 | Custom artifact protocol (`bubbles-artifact://`) | A | **Kept** | Lets renderer display generated images/audio without exposing filesystem |
| 31 | `safeStorage` + OS keychain | A (partial) + B | **Kept** | Cross-platform; replaces macOS-only `/usr/bin/security` |
| 32 | Universal `redactSecrets` pass | A | **Kept** | Applied to every persistence boundary and log line |
| 33 | Observability NDJSON (`trace.ts`) | A | **Kept** | TraceContext with `voiceTurnId / taskId / approvalId` cross-refs |
| 34 | Cost-meter with per-provider tracking | B (expanded) | **Rebuilt** | Multi-vendor: Anthropic, OpenAI, ElevenLabs, Deepgram, Replicate, Suno, Tavily |
| 35 | Versioned IPC channels (`v1:*`) + Zod | B | **Kept** | Excellent boundary discipline |
| 36 | `withTurnId` correlation logger | B | **Kept** | Carries through STT → LLM → TTS pipeline |
| 37 | Test mode (`BUBBLES_TEST_MODE=1`) | B | **Kept** | Expanded with fixtures for every provider |
| 38 | MiniMax CLI install/auth wizard | A | **Dropped** | No CLI in v3; setup wizard now configures per-provider API keys |
| 39 | Multi-step setup wizard (state machine) | A | **Rebuilt** | Same state-machine pattern; new steps: LLM key → STT/TTS key → optional image/music key → mic permission → done |
| 40 | Tray + global shortcut (`Ctrl+Space`) | B | **Kept** | OS integration; works cross-platform |
| 41 | Per-agent skills.md + filesystem registry | A + B | **Kept** | Replace hand-rolled parser with `gray-matter` |
| 42 | Tinted sprite per agent | B | **Kept** | Visual differentiation without sprite duplication |
| 43 | Hard-blocked visual fields on agent schema | A | **Kept** | Prevents LLM-generated agents from mutating avatar |
| 44 | Voice barge-in (interrupt TTS) | A | **Kept** | Critical UX; new implementation uses MediaSource `endOfStream()` + WebSocket close |
| 45 | Captions during TTS + STT partial | A | **Kept** | Accessibility + parity |
| 46 | Redacted log export | A | **Kept** | Audit trail |
| 47 | Conversation list UI | neither | **Built** | Both versions had DB headroom; v3 ships the UI |
| 48 | Per-payload allow-list (tool_name + sha256(args)) | B (schema only) | **Built** | Tighter than per-tool; preserves Version B's schema headroom |

---

## 4. Cross-Cutting Decisions

### 4.1 Primary LLM: Anthropic Claude Sonnet 4.6

- **Why over MiniMax M2.7:** MiniMax was the source of CLI breakage; Anthropic SDK is battle-tested, supports streaming + tool use + prompt caching natively, and has cross-platform reliability.
- **Model IDs:** Primary `claude-sonnet-4-6`; fast/cheap tasks (intent classification refinement, memory extraction) `claude-haiku-4-5-20251001`; complex reasoning escalations `claude-opus-4-7`.
- **Prompt caching:** ON for system prompts and agent skills.md content (5 min TTL).

### 4.2 Cross-Platform from Day One

- Windows 10+, macOS 12+, Ubuntu 22.04+ all supported.
- No `/usr/bin/security`, no `say`, no platform-specific shellouts.
- ABI binaries for `better-sqlite3` ship for all three platforms via electron-rebuild on CI.

### 4.3 No CLI Anywhere

- All AI providers reached via official SDKs over HTTPS.
- File I/O via Node `fs/promises` from main process.
- Static-site preview via in-process Vite (`vite.build()` + `vite.preview()` programmatic APIs), not shell-outs.
- The only `child_process.spawn` allowed is for optional Piper TTS (bundled local binary).

### 4.4 Voice Primary, Text Secondary

- Mic permission requested during setup, not on first turn.
- Push-to-talk + continuous modes both supported.
- Text composer remains visible at all times.

### 4.5 Approval Gate Stays Hard

- New action types default to **high** risk.
- Approval previews are deep-redacted before persistence.
- AlwaysAllow is per-payload (sha256 args hash), not per-tool.

### 4.6 Local-First Persistence

- All conversations, memories, timeline, approvals, connector configs in `<userData>/bubbles.sqlite` (single file, WAL).
- API keys in OS keychain via Electron `safeStorage`.
- Generated artifacts in `<userData>/artifacts/`.
- Nothing leaves the device except payloads explicitly sent to AI providers.

---

## 5. Out-of-Scope for v3

Drawing a clear line so v3 ships:

- Email / Calendar integration (deferred to v4)
- Multi-agent coordination / delegation (v4)
- Vector recall over memory (v4 — schema headroom in v3)
- Auto-update channel (scaffolding in v3, dormant)
- Code signing / notarization (post-v3 release engineering)
- Mobile / web versions
- Plugin or third-party agent marketplace
- General-purpose shell command tool

---

## 6. References

- [01-Full-Functional-Requirements.md](01-Full-Functional-Requirements.md)
- [02-Full-Development-Plan.md](02-Full-Development-Plan.md)
- [03-Full-Backend-Plan.md](03-Full-Backend-Plan.md)
- [04-Full-Frontend-Plan.md](04-Full-Frontend-Plan.md)
- [05-Full-AI-Integrations-Plan.md](05-Full-AI-Integrations-Plan.md)
- [06-Full-ThirdParty-Integrations-Plan.md](06-Full-ThirdParty-Integrations-Plan.md)
- [Change-Log.md](Change-Log.md)
