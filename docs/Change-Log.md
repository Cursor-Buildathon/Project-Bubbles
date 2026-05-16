# Bubbles v3 — Architectural Change Log

> **Purpose:** Major architectural decisions and trade-offs for v3 versus Versions A (MiniMax CLI-Integrated) and B (Non-CLI). Each entry: what changed, the alternatives considered, the trade-off accepted, and the failure-mode evidence that drove it.

---

## CL-001 — Eliminate the MiniMax CLI entirely

**Change.** Version A delegated all LLM, image, music, and TTS work to the `mmx` CLI binary, installed into `<userData>/tools/mmx-cli/bin/`. v3 deletes that pathway and reaches every provider through official SDKs or direct HTTPS from the Electron main process.

**Alternatives considered:**
1. Keep the CLI but harden install + retry. — Rejected. The failure surface was structural (ABI mismatches, region detection, stalled-timeout false positives), not patchable.
2. Move CLI work to a hidden child Node process speaking JSON-RPC. — Rejected. Adds a process boundary for no benefit; SDKs already work in-process.
3. **Direct SDK calls from main.** — Chosen. Fewer moving parts, better error semantics, faster cold start, no install step.

**Trade-off accepted.**
- Bubbles installer no longer needs `npm install --global` privileges → lower trust ask + faster onboarding.
- Per-provider SDKs add dependency weight (~12 MB after tree-shaking), but tree-shaking is more reliable than a CLI binary's ABI compatibility matrix.
- Each provider failure now lives in its own adapter — easier to isolate and test.

**Evidence.** Version A's documented failure list (CLI Full Functional Analysis §17 "Failure Modes") concentrates around CLI calls: stalled timeouts, region detection, install errors, quota check failures, auth refresh failures. None of those classes exist in v3.

---

## CL-002 — Switch primary LLM from MiniMax M2.7 to Anthropic Claude Sonnet 4.6

**Change.** MiniMax was the brain in both A and B. v3 uses Anthropic Claude Sonnet 4.6 as the primary LLM, with OpenAI GPT-4o as cross-vendor fallback.

**Alternatives considered:**
1. Continue with MiniMax via direct HTTPS (no CLI). — Rejected. Reliability concerns persist (regional auth, JSON response stability documented in Version A's `findBalancedJsonEnd` workaround), and MiniMax's tool-use story is less mature than Anthropic's.
2. OpenAI as primary. — Considered as a strong second; chosen as fallback for redundancy.
3. **Anthropic primary, OpenAI fallback.** — Chosen.

**Trade-off accepted.**
- Slightly higher per-token cost than MiniMax (~2×) for Sonnet vs M2.7.
- Better quality, faster TTFT, stable JSON via tool use, native prompt caching → fewer retries → net cost wash in practice.
- Adds dependency on Anthropic availability; mitigated by fallback chain.

**Evidence.** Version A shipped a custom `findBalancedJsonEnd` parser specifically to recover from MiniMax preambles and trailing prose in JSON responses. That class of brittleness disappears with Anthropic's tool-use channel.

---

## CL-003 — Replace `sql.js` (WASM SQLite) with `better-sqlite3` (native)

**Change.** Version A persisted state to `sql.js` (WASM) which requires writing the full DB blob on every `persist()`. Version B used `better-sqlite3` with WAL. v3 standardizes on `better-sqlite3@12.x` everywhere.

**Alternatives considered:**
1. Keep `sql.js` for portability. — Rejected. Whole-blob persistence is unacceptable at scale; crash-mid-write loses everything.
2. Move to `libsql` (forked SQLite). — Rejected. Adds dependency on a smaller upstream.
3. Move to `node:sqlite` (Node 22's built-in). — Considered. Currently behind a flag in Node 22; not production-ready in Electron 32's bundled Node. Revisit for v4.
4. **`better-sqlite3@12.x` (native, WAL).** — Chosen.

**Trade-off accepted.**
- Requires per-platform prebuilt binaries (Win/Mac-Intel/Mac-ARM/Linux). `electron-rebuild` + the `select-sqlite-binary.mjs` pattern from Version B handles this.
- Two ABI flavors needed (Node 22 for tests, Electron 32 for runtime); CI swaps via `postinstall` hook (proven in B).
- Synchronous API blocks the main event loop — but inserts/reads are sub-ms at our scale; acceptable.

**Evidence.** Version A's `sqliteDatabase.ts` writes the full DB on every change. With memory + timeline + approvals + connectors accumulating per turn, this is O(n) in stored size, growing without bound. better-sqlite3 with WAL is O(1) per insert.

---

## CL-004 — Cloud STT primary (Deepgram + Whisper), local fallback (whisper.cpp)

**Change.** Versions A and B both shipped without working STT — either Web Speech API (browser-only, flaky on Electron Windows) or unbundled-provider scaffolding. v3 ships three production-grade STT providers from day one.

**Alternatives considered:**
1. Web Speech API. — Rejected. Browser-only, no reliable Electron support, no streaming.
2. Native OS APIs (Windows SpeechRecognizer, macOS Speech framework). — Rejected. Different APIs per OS, no Linux support, lower accuracy than cloud STT.
3. Single cloud provider. — Rejected. Voice is too critical for single-vendor reliance.
4. **Deepgram primary (WS streaming) → OpenAI Whisper (HTTPS) → whisper.cpp (local).** — Chosen.

**Trade-off accepted.**
- whisper.cpp adds ~141 MB to the installer (`ggml-base.en.bin`). Mitigated: only English in v3; model file is the most-common English model; v3.x could move to smaller `tiny.en` if needed.
- Per-minute cost (~$0.0043 + occasional Whisper $0.006) is acceptable within the daily cap budget.
- Three implementations to maintain. Mitigated: thin `SttProvider` interface with shared tests.

**Evidence.** Version A's `Cross-Reference Index` row "Voice STT input | 🟡 Partial | IPC + state machine ready; real STT provider must be wired" is the exact gap v3 closes.

---

## CL-005 — Cloud TTS primary (ElevenLabs + OpenAI), local fallback (Piper)

**Change.** Version A used the macOS `say` binary (macOS-only) + flaky `window.speechSynthesis`. Version B used MiniMax Speech-02-Turbo + the same browser fallback. v3 uses ElevenLabs Turbo v2.5 as the primary TTS, OpenAI tts-1-hd as a cross-vendor fallback, and Piper as an offline fallback.

**Alternatives considered:**
1. Continue MiniMax TTS via direct HTTPS. — Rejected. Limited voice library, no streaming WebSocket protocol on par with ElevenLabs, single-vendor risk.
2. ElevenLabs primary, MiniMax fallback. — Rejected. Same single-vendor concern; OpenAI is a more reliable second source.
3. Azure Neural TTS as primary. — Considered. Azure has better voice variety in some languages; ElevenLabs wins on expressiveness + TTFA in English.
4. **ElevenLabs → OpenAI → Piper.** — Chosen.

**Trade-off accepted.**
- Piper adds ~65 MB to the installer (`en_US-amy-medium.onnx` + binary). Worth it for guaranteed offline path.
- ElevenLabs Creator+ tier ($22/mo) is a real cost; documented in setup wizard.
- Three TTS providers to maintain.

**Evidence.** Both Versions A and B documented TTS as "shipped" but in practice the macOS `say` path failed cross-platform and `window.speechSynthesis` was unreliable on Electron Windows (multiple known Chromium bugs around speech synthesis IPC).

---

## CL-006 — Emotional layer becomes three-source (regex + Haiku + Hume)

**Change.** Version A had a regex-only `AffectDetector`. v3 keeps the regex baseline (deterministic, fast, free) and adds two enrichment layers: a Claude Haiku text classifier (semantic accuracy) and Hume EVI prosody (audio-side richness).

**Alternatives considered:**
1. Keep regex only. — Rejected. Misses sarcasm, context-dependent emotion, prosodic cues.
2. LLM-only classification per turn. — Rejected. Adds latency; cost adds up; LLMs are inconsistent on borderline cases.
3. Hume-only (audio). — Rejected. Doesn't work for typed turns.
4. **Three-source fusion.** — Chosen.

**Trade-off accepted.**
- Hume EVI is a paid third-party with limited free tier; isolated as enhancement-only so the system works without it.
- Fusion logic is non-trivial to tune; Phase 3 includes a 50-turn manual eval to lock in weights.
- Per-turn cost adds ~$0.001–0.005; rolls into the daily cap.

**Evidence.** Version A's regex-only detector misclassified ~30 % of borderline-affect lines in informal QA (sarcasm, mixed-emotion lines). The audio prosody channel is the only path to detecting frustration that isn't lexicalized.

---

## CL-007 — Drop email + calendar integration from v3

**Change.** Version A invested heavily in Gmail / Google Calendar MCP HTTP transport but shipped without an OAuth flow — the user had to set env vars manually. v3 removes the entire email/calendar surface from scope.

**Alternatives considered:**
1. Build full OAuth + Gmail/Calendar integration. — Rejected. Material engineering investment (OAuth flow, token refresh, scope management, error handling) for a capability not in the required-capability list.
2. Ship the half-built MCP transport. — Rejected. User experience would degrade beta confidence.
3. **Defer to v4.** — Chosen.

**Trade-off accepted.**
- Loses a feature some users might want.
- Frees an estimated 4–6 engineer-weeks for stabilizing the required capabilities.
- Sets up v4 for a clean rebuild with Google Workspace Connect or similar managed OAuth.

**Evidence.** Version A's table "Functional Matrix" rows for Email and Calendar connectors are marked "🟡 Partial — MCP path implemented, real OAuth flow not bundled."

---

## CL-008 — Drop MCP transport; use direct SDK adapters

**Change.** Version A had an `McpClient` (both stdio and HTTP transports) for connectors. v3 deletes the MCP abstraction and instead uses each provider's official SDK or direct HTTPS.

**Alternatives considered:**
1. Keep MCP for future plugin ecosystem. — Rejected. MCP isn't widely supported outside Anthropic Claude Desktop; users aren't running their own MCP servers; the abstraction adds two transports' worth of code for no current benefit.
2. Adopt MCP for Anthropic-only tool servers (e.g., a sandbox or vector DB). — Considered. v4 may revisit.
3. **Direct SDK adapters per provider.** — Chosen.

**Trade-off accepted.**
- No plug-and-play for community MCP servers.
- Simpler codebase; each adapter is purpose-built and well-typed.
- Future plugin SDK in v4 can be MCP-based.

**Evidence.** Version A's `McpClient` is 200+ LoC with two transports and zero production usage outside the Tavily fixture (which works equally well via direct HTTPS).

---

## CL-009 — Approval gate becomes payload-scoped, not tool-scoped

**Change.** Versions A and B had per-tool "Always Allow." Version B had a `permissions.payload_hash` column wired but unused. v3 uses it: the allow-list key is `tool_name + sha256(JSON.stringify(args))`.

**Alternatives considered:**
1. Keep per-tool. — Rejected. Too loose: approving `writeFile` once allows arbitrary future writes to any path.
2. Path-prefix scoping (e.g., allow writes under `./src/`). — Considered for v3.1; adds UI complexity.
3. **Payload-hash scoping.** — Chosen as v3 baseline; path-prefix is additive in v3.x.

**Trade-off accepted.**
- A second write to a slightly different path/content prompts again. (Mitigated: user can still approve in one click.)
- Hash collisions are cryptographically negligible (sha256).
- Persistent allow rows accumulate over time — DAO includes a `cleanup_expired` task.

**Evidence.** Version B's `Known Limitations` explicitly calls out "AlwaysAllow is per-tool, not per-payload. The `permissions.payload_hash` column is wired but unused; tightening this is a known follow-up."

---

## CL-010 — Renderer enters full sandbox

**Change.** Versions A and B used `contextIsolation: true, nodeIntegration: false` but did not set `sandbox: true`. v3 enables full sandbox mode for both renderers.

**Alternatives considered:**
1. Keep partial isolation. — Rejected. Defense in depth matters for an AI app that surfaces external content (web search snippets, generated HTML in landing-page previews).
2. **Full `sandbox: true` + restrictive CSP.** — Chosen.

**Trade-off accepted.**
- Preload script can use only a subset of Node APIs (no `fs` from preload). Required us to move all logic to main and expose typed RPCs.
- Code style is purer: renderer is browser-context-only.

**Evidence.** No prior failure caused this; it's a hardening upgrade aligned with Electron 32+ best practices.

---

## CL-011 — Replace hand-rolled skills.md parser with `gray-matter`

**Change.** Version B's `SkillsCompiler` hand-rolled YAML frontmatter parsing (single-line values, `- ` lists). v3 uses `gray-matter` for frontmatter + `marked` for the body.

**Alternatives considered:**
1. Keep hand-rolled parser. — Rejected. Fragile to multi-line values, block scalars, comments.
2. `js-yaml` + manual section splitting. — Acceptable but `gray-matter` is purpose-built.
3. **`gray-matter` (battle-tested).** — Chosen.

**Trade-off accepted.**
- Adds ~30 KB (minified+gzipped) dependency.
- More forgiving of community-contributed agents.

**Evidence.** Version B's "Known Limitations" calls this out: *"Hand-rolled `skills.md` parser — only single-line frontmatter values and `- ` lists are supported."*

---

## CL-012 — Per-window IPC bridge `window.bubbles.*` (kept), Zod-validated (kept), with v1 prefix (kept)

**Change.** Both versions used a typed contextBridge surface. Version B added Zod validation + `v1:` channel prefix. v3 keeps all of this and extends it to every new channel.

**No alternative considered** — this is best practice and worked. Documenting here so the pattern is visible.

---

## CL-013 — Cross-platform from day one

**Change.** Version A was effectively macOS-only (Keychain via `/usr/bin/security`, `say` binary). Version B targeted Windows + macOS but had known transparent-window quirks on Windows. v3 commits to Win 10+, macOS 12+, Ubuntu 22.04+ on equal footing.

**Alternatives considered:**
1. macOS-first, Win later. — Rejected. Both Version A pain points and a likely majority of beta users are on Windows.
2. Windows-first. — Rejected. macOS is too important.
3. **Tri-platform from day one with CI gates.** — Chosen.

**Trade-off accepted.**
- Larger CI matrix (~3× minutes).
- Smaller per-platform polish budget (acceptable; design partners on each OS in P8 close gaps).
- No `say`, no Keychain via shell, no platform-only code paths.

**Evidence.** Version A's "Known Limitations" — *"SecureKeyStore and speechPlayback.say are macOS-only. Windows/Linux abort on setup."*

---

## CL-014 — `electron-builder` packaging (kept) + add Linux AppImage

**Change.** Both versions used `electron-builder`. v3 extends to AppImage + `.deb` for Linux.

**Trade-off accepted.**
- AppImage runs unsigned by default on most Linux distros — acceptable.
- Adds Linux test target.

---

## CL-015 — Affect-aware spoken response policy (kept + tuned)

**Change.** Version A's `prepareSpokenResponse` with 280-char / 40-word cap is excellent UX. v3 keeps it and adds per-affect threshold tuning: `urgent` turns may go slightly longer (320 chars) because users want the full plan delivered; `confused` turns stay tighter (220 chars) to invite a follow-up.

**Evidence.** Voice UX feedback from internal Version A demos — long replies felt verbose, but cutting short on `urgent` requests felt dismissive.

---

## CL-016 — Cost meter expanded to multi-provider

**Change.** Versions A and B tracked MiniMax-only costs. v3 tracks every paid provider (Anthropic, OpenAI, Deepgram, ElevenLabs, Replicate, Suno, Tavily, Hume).

**Trade-off accepted.**
- `cost_events` table grows faster (every turn writes 2–4 events).
- Per-provider breakdown adds UI complexity in Spend Dashboard.
- Gives users (especially organizational deployers) the visibility they need.

---

## CL-017 — Landing-page sandbox uses programmatic Vite, not shell-out

**Change.** Version A spawned `node <vite> build` as a child process. v3 calls `vite.build({})` programmatically inside a worker thread.

**Alternatives considered:**
1. Keep `child_process.spawn`. — Rejected. Process boundary adds latency (~600 ms) and error surface (spawn failures, PATH issues, zombie processes).
2. Vite in-process on the main thread. — Rejected. Build CPU time would block IPC and TTS.
3. **Vite in a `worker_threads` worker.** — Chosen.

**Trade-off accepted.**
- Bundling Vite into the app increases installer size by ~12 MB.
- Programmatic API is stable; worker isolation prevents event-loop blocking.
- Faster + cleaner error reporting.

**Evidence.** Version A's `child_process.spawn` for `vite build` is a documented failure path under PATH-stripped environments (e.g., notarized macOS bundles).

---

## CL-018 — Setup wizard becomes multi-key + resumable

**Change.** Versions A and B asked for a single MiniMax API key. v3's wizard captures Anthropic (required), STT/TTS keys (recommended), optional image/music keys, mic permission, and workspace folder — and is resumable from any step on relaunch.

**Trade-off accepted.**
- More setup friction.
- Mitigated by: required vs optional grouping; one-click "Open dashboard" deep links; ability to skip optional providers and add later in Settings.

---

## CL-019 — Trace events become first-class

**Change.** Version A had `appendTraceEvent` + NDJSON. v3 promotes this to a `packages/observability` package with typed event schemas and standardized `traceId / voiceTurnId / taskId / approvalId / ttsId` fields on every event.

**Trade-off accepted.**
- Disciplined typed events vs ad-hoc logging.
- Enables future structured queries (e.g., "show me every voice turn where TTFA > 500 ms").

---

## CL-020 — Visual customization remains hard-blocked on agent schema

**Change.** Version A's schema rejected `color`, `theme`, `sprite`, `costume`, `prop`, `avatarStyle`, `appearance` at validation time + at LLM-output normalization. v3 keeps this and adds an allow-list for `tint` (12 curated colors) + `voiceId` (12 curated voices) so AI-generated agents can still have visual personality without freely mutating the avatar.

**Trade-off accepted.**
- Less expressiveness in agent design.
- Predictable, safe avatar behavior — no malicious or jarring AI-driven visual changes.

**Evidence.** Version A's safety design correctly identified that letting an LLM write arbitrary `sprite` fields is an injection vector. v3 preserves the safety while expanding controlled personality.

---

## CL-021 — Drop generic shell tool entirely

**Change.** Neither A nor B shipped a free-form `shell_command` tool, but the `actionType: 'shell_command'` type existed in the approval enum (Version A used it for the landing-page workflow). v3 narrows: only landing-page generation can produce a `shell_command` approval, and the allow-list of executable commands is enforced at handler level.

**Trade-off accepted.**
- No general shell tool available to agents.
- Sharp scope reduction; reduces blast radius.

---

## CL-022 — Test mode (`BUBBLES_TEST_MODE=1`) standardized

**Change.** Version B's test mode (canned MiniMax + silent MP3) is excellent. v3 standardizes test mode across **every provider category**: STT, TTS, LLM, image, music, search, affect.

**Trade-off accepted.**
- Test-mode fixtures must be maintained alongside real adapters.
- Worth it: deterministic E2E + screencasts + offline demos.

---

## CL-023 — No user accounts; bring-your-own-key only

**Change.** Neither version had user accounts. v3 explicitly commits to never adding them in v3.x: every paid provider is "bring your own key."

**Alternatives considered:**
1. Add Bubbles-managed key proxy with subscription. — Rejected for v3. Adds backend, billing, support burden; pivots the product from a desktop pet to a SaaS.
2. **Pure BYOK.** — Chosen.

**Trade-off accepted.**
- Setup friction.
- No revenue from v3 itself (positioning aligns with open-beta / OSS / pay-via-providers).
- Removes a class of security concerns (centralized key custody).

---

## CL-024 — Required-capability scope is hard

**Change.** v3's scope is deliberately the eight required capabilities + Agents Birth + supporting architecture. Tempting adjacent work (vector recall, calendar, plugin SDK, multi-agent) is **deferred to v4** with no half-implementations shipped.

**Trade-off accepted.**
- Tight scope means smaller surface area to ship + maintain.
- Predictable v3.0 ship date.
- Pent-up demand for v4 features.

**Evidence.** Both Versions A and B accumulated schema headroom (`memories`, `files`, `decisions`, `timeline_events`) and IPC channels that were never user-visible. v3 ships exactly what's used.

---

## Summary Table

| # | Change | Driver |
|---|---|---|
| CL-001 | Remove MiniMax CLI | Hard constraint; CLI was root of failures |
| CL-002 | Anthropic Claude Sonnet 4.6 primary LLM | Reliability + caching + tool use |
| CL-003 | `better-sqlite3` over `sql.js` | Persistence performance + crash safety |
| CL-004 | Deepgram + Whisper + whisper.cpp STT | Voice C1 must work cross-platform |
| CL-005 | ElevenLabs + OpenAI + Piper TTS | Voice C2 must work cross-platform |
| CL-006 | Three-source affect fusion | Emotional layer C3 requires richer signal |
| CL-007 | Drop email/calendar | Out of required scope; OAuth burden |
| CL-008 | Drop MCP transport | YAGNI; direct SDKs are simpler |
| CL-009 | Payload-scoped Always-Allow | Tighter security model |
| CL-010 | Full renderer sandbox | Defense in depth |
| CL-011 | `gray-matter` over hand-rolled parser | Robustness |
| CL-012 | Keep `v1:*` channels + Zod | Worked, no change |
| CL-013 | Cross-platform Day 1 | Strategic |
| CL-014 | Linux AppImage added | Coverage |
| CL-015 | Affect-aware spoken policy | UX refinement |
| CL-016 | Multi-provider cost meter | Visibility for users + organizations |
| CL-017 | Programmatic Vite (worker thread) | Reliability + speed |
| CL-018 | Multi-step resumable setup | More providers, less re-entry friction |
| CL-019 | First-class observability package | Audit + debugging |
| CL-020 | Curated tint + voice allow-list on agents | Safety + personality |
| CL-021 | No generic shell tool | Tight scope |
| CL-022 | Standard test mode across providers | Demo + CI reliability |
| CL-023 | No user accounts; BYOK | Strategic |
| CL-024 | Scope discipline (no v4 spillover) | Ship v3.0 on schedule |

---

## References

- [00-Audit-and-Decision-Log.md](00-Audit-and-Decision-Log.md) — concise feature-by-feature kept/dropped/rebuilt table.
- [01-Full-Functional-Requirements.md](01-Full-Functional-Requirements.md) through [06-Full-ThirdParty-Integrations-Plan.md](06-Full-ThirdParty-Integrations-Plan.md) — implementation-level detail.
- Original docs:
  - [CLI-Integrated-Bubbles-Full-Functional-Analysis.md](../CLI-Integrated-Bubbles-Full-Functional-Analysis.md)
  - [CLI-Integrated-Bubbles-Technical-Analysis.md](../CLI-Integrated-Bubbles-Technical-Analysis.md)
  - [CLI-Non-Integrated-Bubbles-Full-Functional-Analysis.md](../CLI-Non-Integrated-Bubbles-Full-Functional-Analysis.md)
  - [CLI-Non-Integrated-Bubbles-Technical-Analysis.md](../CLI-Non-Integrated-Bubbles-Technical-Analysis.md)
