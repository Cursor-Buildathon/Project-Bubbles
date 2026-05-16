# Bubbles v3 — Full Third-Party Integrations Plan

> **Audience:** Tech leads, finance/ops, security review.
> **Pair with:** [05-Full-AI-Integrations-Plan.md](05-Full-AI-Integrations-Plan.md) for model-side technical detail.

This document covers every external service Bubbles v3 depends on: auth model, rate limits, cost model, fallback handling, and vendor lock-in posture.

---

## 1. Service Inventory

| # | Service | Category | Tier (v3 default) | Required? |
|---|---|---|---|---|
| 1 | **Anthropic** | LLM reasoning | API | **Required** (LLM is the brain) |
| 2 | **OpenAI** | LLM fallback + STT fallback + TTS fallback + image fallback | API | Recommended (provides redundancy across 4 categories) |
| 3 | **Deepgram** | STT primary | API (Growth or Pay-as-you-go) | **Required for voice** (degrades to OpenAI Whisper if absent) |
| 4 | **ElevenLabs** | TTS primary | API (Creator+) | **Required for voice** (degrades to OpenAI TTS if absent) |
| 5 | **Hume AI** | Affect (prosody) | API | Optional (enhances emotional layer) |
| 6 | **Replicate** | Image primary + Music fallback | API (Pay-as-you-go) | **Required for image/music** |
| 7 | **Suno** | Music primary | API (Pro tier; via partner if direct unavailable) | Optional (degrades to Replicate MusicGen) |
| 8 | **Stability AI** | Image fallback 2 | API | Optional |
| 9 | **Tavily** | Web search primary | API (Researcher tier) | **Required for research** (degrades to Brave) |
| 10 | **Brave Search** | Web search fallback | API (Pro / free tier) | Optional |
| 11 | **GitHub** | Source hosting + CI + release | Free for OSS / Team for private | **Required for development** |
| 12 | **Sentry** | Error monitoring (opt-in user telemetry) | Developer or Team | Optional |
| 13 | **Apple Developer Program** | macOS code signing + notarization (v3.0.1+) | $99/yr | Required for signed Mac build |
| 14 | **EV Code Signing Cert** (Win) | Windows code signing | varies | Required for unflagged Win installer |

For v3.0 launch, **only items 1, 3 or 6, 4 or 6, 6, 9** are required at minimum to deliver C1–C9. Setup wizard makes other keys optional.

---

## 2. Auth Model

All third-party API keys are entered by the user via the Setup Wizard or Settings → Providers. Storage is via Electron `safeStorage`:

```ts
// packages/secure/src/secureKeyStore.ts
export interface SecureKeyStore {
  set(provider: ProviderId, key: string): Promise<void>;
  get(provider: ProviderId): Promise<string | null>;
  remove(provider: ProviderId): Promise<void>;
  has(provider: ProviderId): Promise<boolean>;
}

class ElectronSafeStorageKeyStore implements SecureKeyStore {
  constructor(private storeFile: string) {}

  async set(provider: ProviderId, key: string) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage unavailable');
    const ciphertext = safeStorage.encryptString(key);
    const all = this.readFile();
    all[provider] = ciphertext.toString('base64');
    this.writeFile(all);
  }

  async get(provider: ProviderId) {
    const all = this.readFile();
    const b64 = all[provider];
    if (!b64) return null;
    return safeStorage.decryptString(Buffer.from(b64, 'base64'));
  }
  // ...
}
```

Encryption backing:
- **macOS** → Keychain via DPAPI-like mechanism.
- **Windows** → DPAPI (per-user).
- **Linux** → libsecret if available (kwallet / gnome-keyring). If not, `safeStorage.isEncryptionAvailable()` returns `false` → setup wizard warns and asks for confirmation before storing keys in plaintext-fallback (per-file mode permissions 0600).

Each provider's key is **only loaded into memory at startup** (after `app.whenReady()` + `safeStorage` ready). When sending requests, the key never leaves main process. The renderer sees only a redacted form (`sk-***ng...3a`) for the Settings UI.

---

## 3. Cost Model (Per-Provider)

### 3.1 Pricing Table (2026-05 snapshot — adjustable in `<userData>/pricing.json`)

```json
{
  "anthropic": {
    "claude-sonnet-4-6":      { "input_per_mtok": 3.00,  "output_per_mtok": 15.00, "cache_write_per_mtok": 3.75,  "cache_read_per_mtok": 0.30 },
    "claude-opus-4-7":        { "input_per_mtok": 15.00, "output_per_mtok": 75.00, "cache_write_per_mtok": 18.75, "cache_read_per_mtok": 1.50 },
    "claude-haiku-4-5":       { "input_per_mtok": 0.80,  "output_per_mtok": 4.00,  "cache_write_per_mtok": 1.00,  "cache_read_per_mtok": 0.08 }
  },
  "openai": {
    "gpt-4o":                 { "input_per_mtok": 2.50,  "output_per_mtok": 10.00 },
    "gpt-4o-mini":            { "input_per_mtok": 0.15,  "output_per_mtok": 0.60 },
    "whisper-1":              { "per_minute": 0.006 },
    "tts-1-hd":               { "per_1k_chars": 0.030 },
    "gpt-image-1":            { "per_image_1024_high": 0.190 }
  },
  "deepgram": {
    "nova-3-streaming":       { "per_minute": 0.0043 }
  },
  "elevenlabs": {
    "turbo-v2.5":             { "per_1k_chars": 0.30 }
  },
  "hume": {
    "evi-prosody":            { "per_minute": 0.10 }
  },
  "replicate": {
    "flux-1.1-pro":           { "per_image": 0.04 },
    "musicgen-large":         { "per_second_audio": 0.0015 }
  },
  "suno": {
    "chirp-v4.5":             { "per_30s_track": 0.10 }
  },
  "tavily": {
    "search-advanced":        { "per_query": 0.008 },
    "search-basic":           { "per_query": 0.002 }
  },
  "brave": {
    "web-search":             { "per_1k_queries_paid": 3.00, "free_monthly": 2000 }
  }
}
```

### 3.2 Per-Capability Cost Estimate (typical usage)

| Capability | Cost per call (typical) |
|---|---|
| Voice turn (Sonnet, ~600 input + 200 output tokens cached + STT 5 s + TTS 80 chars) | $0.0024 (LLM) + $0.0004 (STT) + $0.0024 (TTS) + $0.0008 (Hume optional) ≈ **$0.0060** |
| Text turn (Sonnet) | ~$0.0024 |
| Web research turn (Tavily + Sonnet synthesis) | $0.008 + $0.005 = **$0.013** |
| Image generation (FLUX) | **$0.04** |
| Music generation (Suno 30 s) | **$0.10** |
| Music generation (MusicGen 30 s fallback) | **$0.045** |
| Landing page generation (Sonnet, ~5k input + 2k output) | **$0.045** |
| Agent birth preview | ~**$0.012** |
| Memory extraction per turn (Haiku) | **$0.0005** |

**Daily user budget benchmark:** A power user doing 50 voice turns + 5 research + 3 images + 1 music + 1 landing page ≈ **$0.95/day**. Daily cap default of **$5.00** covers heavy use; user can raise.

### 3.3 Cost Cap Enforcement

`CostMeter.isOverCap(capUsd)` is consulted **before** every external API call (LLM, STT, TTS, image, music, search, affect). If over cap:
- Voice turn → friendly TTS-free chat error: *"I've hit today's spend cap. Raise it in Settings."*
- Any creative task → approval cannot be approved; chat shows refusal.
- Setup wizard cannot test providers (uses a small daily test budget instead).

---

## 4. Rate Limits & Quotas

| Provider | Limit (default tier) | Bubbles handling |
|---|---|---|
| Anthropic | 50 req/min, 40k input tok/min, 8k output tok/min (Tier 1) | Backoff 1–8s jittered; user-visible toast on persistent 429 |
| OpenAI | Tiered; new accounts ~500 req/min | Same |
| Deepgram | 100 concurrent streams (Growth) | Bubbles uses 1 — never hits limit in practice |
| ElevenLabs | Concurrent streams: Creator 2, Pro 5; chars/mo: Creator 100k, Pro 500k | Toast at 90 % monthly usage; auto-downgrade to OpenAI TTS at 100 % |
| Hume EVI | 30 concurrent (default) | 1 stream max — fine |
| Replicate | 600 req/min (default) | Same |
| Suno | Varies (~10 concurrent on Pro) | Polling intervals tuned to avoid burst |
| Tavily | Researcher: 1k/day, Pro: 4k/day | Auto-fallback to Brave at 90 % daily |
| Brave Search | Free 2k/month, then paid | Monthly counter in Settings; warning at 80 % |
| Stability AI | 150 req/min | Used last; rare |

### 4.1 Backoff Policy

`packages/llm/src/backoff.ts` — port from Version B:
- 3 attempts.
- Base 1 s, jitter ±50 %, cap 8 s.
- Retry on: 429, 500–599, network errors (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`).
- Fail-immediately on: 400, 401, 403, 404, 422.

---

## 5. Vendor Lock-in & Portability

### 5.1 Lock-in posture

Bubbles' provider abstraction layer means swapping any single vendor is a **bounded code change**: implement a new `Provider` interface, register it, optionally make it the new default. Concretely:

| Category | Lock-in level | Effort to swap |
|---|---|---|
| LLM | **Low** | `LlmClient` is provider-agnostic via `AnthropicAdapter` / `OpenAiAdapter`. Adding a third provider = ~200 LoC + tests. |
| STT | **Low** | `SttProvider` interface; three already exist. |
| TTS | **Low** | Same as STT. |
| Image | **Low** | `ImageProvider` interface. |
| Music | **Medium** | Suno's async job model differs from MusicGen's sync; `MusicProvider` interface handles both, but specific provider quirks (e.g., Suno's lyrics format) leak into the interface. |
| Affect | **Low** | Hume is enhancement-only; regex + Haiku always work. |
| Web Search | **Low** | Tavily/Brave/Fixture all behind one interface. |
| Hosting / Distribution | N/A | Installers self-distributed via GitHub Releases by default; can move to Sparkle / Squirrel. |

### 5.2 No proprietary file formats

- Conversations: SQLite (open).
- Memories: SQLite (open).
- Artifacts: PNG, MP3, HTML/CSS/JS (open).
- Logs: NDJSON (open).
- Agents: filesystem JSON + Markdown (open).

A user can export, version-control, and migrate Bubbles state independently of any vendor.

### 5.3 Bring-your-own-key model

Every API key is the user's. Bubbles never proxies through a Bubbles-controlled gateway in v3. This:
- Removes our liability for usage costs.
- Eliminates a Bubbles-side authentication infrastructure (no user accounts in v3).
- Limits abuse vectors (no shared keys).

Tradeoff: setup wizard must walk users through obtaining multiple keys. v3 mitigates with:
- One-click "Open dashboard" deep links to each provider's API key page.
- Validating each key with a cheap ping during setup.
- Marking keys as "optional" where degradation is acceptable.

---

## 6. Vendor-Specific Details

### 6.1 Anthropic

- **Account:** https://console.anthropic.com — user creates personal account.
- **Pricing page:** https://www.anthropic.com/pricing
- **Auth header:** `x-api-key: <ANTHROPIC_API_KEY>` (also `anthropic-version: 2023-06-01`).
- **Models we use:** `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-7`.
- **Region:** Global (single endpoint). Latency ~150–400 ms TTFT for Sonnet from US.
- **Data retention:** Per Anthropic policy, API inputs/outputs not used for training; retained ≤ 30 days for trust & safety unless zero-retention enrollment.
- **Failure detection:** standard HTTP status codes; `error.type` field for typed errors.
- **Vendor risk:** Low — primary product; high availability historically.

### 6.2 OpenAI

- **Account:** https://platform.openai.com
- **Auth header:** `Authorization: Bearer <OPENAI_API_KEY>`.
- **Models we use:** `gpt-4o`, `whisper-1`, `tts-1-hd`, `gpt-image-1`.
- **Pricing:** https://openai.com/api/pricing/
- **Data retention:** Per API policy, inputs not used for training after Mar 2023.
- **Vendor risk:** Low.

### 6.3 Deepgram

- **Account:** https://console.deepgram.com — Pay-as-you-go starts at $200 free credit.
- **Auth:** `Authorization: Token <DEEPGRAM_API_KEY>`.
- **Endpoint:** `wss://api.deepgram.com/v1/listen`.
- **Models we use:** `nova-3` (latest as of 2026-05).
- **Data retention:** Off by default when audio_retention=false is passed.
- **Vendor risk:** Medium — single-product company. Have OpenAI Whisper + whisper.cpp as redundancy.

### 6.4 ElevenLabs

- **Account:** https://elevenlabs.io — Creator tier $22/mo minimum for production use; allows API access.
- **Auth:** `xi-api-key: <ELEVENLABS_API_KEY>` header.
- **Endpoint:** REST + WebSocket streaming.
- **Models:** `eleven_turbo_v2_5`.
- **Voice library:** 12 curated voices pre-loaded for v3; user can add via Settings (later v3.1).
- **Quotas:** Character allocation per tier; resets monthly.
- **Vendor risk:** Medium — strong product but pricing has changed. Have OpenAI TTS + Piper as redundancy.

### 6.5 Hume AI

- **Account:** https://www.hume.ai
- **Auth:** `X-Hume-Api-Key: <HUME_API_KEY>`.
- **Endpoint:** `wss://api.hume.ai/v0/stream/models`.
- **Models:** prosody (audio emotion).
- **Vendor risk:** Higher — newer company. Architecture isolates it as enhancement-only.

### 6.6 Replicate

- **Account:** https://replicate.com
- **Auth:** `Authorization: Token <REPLICATE_API_TOKEN>`.
- **Pricing:** Per-second compute time; FLUX 1.1 Pro ~$0.04/image, MusicGen ~$0.045 for 30 s.
- **Cold-start:** Public models warm; FLUX typically warm.
- **Vendor risk:** Low–medium. Heavily used by AI startups.

### 6.7 Suno

- **Direct API status:** As of 2026-05, Suno's official API is in **private beta**. If access is unavailable, v3 ships with the **Topmediai Suno-compatible API gateway** as the default Suno provider (paid third-party).
- **Auth:** Bearer token (Suno direct) or `X-API-Key` (Topmediai).
- **Pricing:** Direct (private beta): ~$0.10 per 30 s track. Topmediai: ~$0.12 per 30 s track.
- **Vendor risk:** **High** — single-product company with restricted API access. Mitigation: Replicate MusicGen-Large is always available as fallback, and v3 ships the music capability with MusicGen alone if Suno is not configured.

### 6.8 Stability AI

- **Account:** https://platform.stability.ai
- **Auth:** Bearer token.
- **Pricing:** ~$0.04 / SD3 image.
- **Use:** Fallback only.
- **Vendor risk:** Medium.

### 6.9 Tavily

- **Account:** https://tavily.com — Researcher tier $30/mo (1k searches/day).
- **Auth:** API key in request body (`api_key` field) or `Authorization: Bearer`.
- **Vendor risk:** Medium — newer. Brave Search is robust fallback.

### 6.10 Brave Search

- **Account:** https://api.search.brave.com
- **Auth:** `X-Subscription-Token: <BRAVE_API_KEY>`.
- **Pricing:** First 2000 queries/month free; then $3 / 1000 queries on Pro.
- **Vendor risk:** Low — backed by Brave (browser company, stable revenue).

### 6.11 GitHub

- Used for source, CI (Actions), releases.
- **Auth:** OAuth or PAT for our internal dev workflow (not user-facing).
- **Risk:** Negligible.

### 6.12 Sentry (Opt-in)

- **Account:** https://sentry.io
- **Used:** Crash reporting if user opts in (off by default).
- **DSN:** Embedded in build.
- **Risk:** Low — telemetry is off by default; redaction is mandatory.

### 6.13 Apple Developer + Windows EV Cert

- **Apple:** $99/yr; allows notarized DMG.
- **Win EV cert:** ~$200–600/yr depending on vendor (Sectigo, DigiCert).
- v3.0 ships unsigned; **v3.0.1 ships signed on both platforms.** Documented in README until v3.0.1.

---

## 7. Onboarding UX (Provider Key Acquisition)

Setup wizard step "Providers" shows a card per provider with:

```
┌─ Anthropic (LLM brain) ─── required ──┐
│                                       │
│ API key: [____________________]       │
│                                       │
│ Don't have one yet?                   │
│ → [Open console.anthropic.com]        │
│                                       │
│ [Test connection]   [Skip for now]    │
└───────────────────────────────────────┘
```

Required providers cannot be skipped; the Skip button is disabled. Optional providers show a "Skip for now" affordance.

"Open console.anthropic.com" calls `shell.openExternal(...)` — never embeds a webview (no scraping or auto-login).

Test button does a minimal probe (a 10-token Claude ping for Anthropic, a 2-second mic stream to Deepgram, etc.) and shows a green check or a redacted error.

---

## 8. Data Going to Each Provider

Cross-reference of what user data leaves the device per turn:

| Provider | Receives | Used for | Retention |
|---|---|---|---|
| Anthropic | User text turn + conversation context + agent skills.md + memory snippets + tool schemas | LLM reasoning | Not for training; ≤ 30 days unless zero-retention |
| OpenAI | Same as Anthropic when fallback; or user audio (Whisper); or response text (TTS); or image prompt | Same | Not for training |
| Deepgram | Mic audio chunks | STT | Off by default |
| ElevenLabs | Response text to synthesize | TTS | Per their policy, retention varies |
| Hume EVI | Mic audio chunks (forked) | Prosody analysis | Per their policy |
| Replicate | Image / music prompt strings | Generation | Per their policy |
| Suno | Music prompt + optional lyrics | Generation | Per their policy |
| Tavily | Search query text | Web search | Per their policy |
| Brave Search | Search query text | Web search | Brave does not track queries to user accounts |

The Privacy section of Settings + the About dialog lists this verbatim so the user is informed.

---

## 9. Failure Modes Per Provider

Cross-reference of how each vendor failure surfaces:

| Provider down | UI surface | Functional impact |
|---|---|---|
| Anthropic (and OpenAI) | Toast "LLM unavailable"; chat shows error; voice turn fails after fallback retry | Total: bot cannot respond. Voice transcript still rendered. |
| Deepgram | Silent fallback to Whisper; if Whisper also fails, fallback to whisper.cpp | Voice still works; partials disappear |
| ElevenLabs | Silent fallback to OpenAI TTS; if that fails, Piper local | TTS still works; voice quality drops |
| Hume EVI | Silent — affect uses regex + Haiku only | Slightly less rich affect |
| Replicate | Toast "Image provider unavailable"; chat shows error; user can retry | Image generation fails (with fallback chain) |
| Suno | Silent fallback to Replicate MusicGen | Music takes longer; quality differs |
| Tavily | Silent fallback to Brave | Research still works |
| Brave Search | Toast "Web search unavailable" if Tavily also down | Research turn fails |

---

## 10. Vendor Procurement Checklist

For an organization deploying Bubbles to a team:

- [ ] Set up an Anthropic workspace with billing; provision per-user API keys OR a shared key with usage limits.
- [ ] Set up a Deepgram account; configure audio retention OFF; provision keys.
- [ ] Set up an ElevenLabs Creator+ subscription; share voice library.
- [ ] Set up a Replicate account; pre-fund $50–200 credit per user.
- [ ] (Optional) Set up Hume AI account.
- [ ] (Optional) Set up Suno API access; have Replicate as fallback.
- [ ] Set up Tavily Researcher tier.
- [ ] Document daily cap policy per user.
- [ ] Document data-flow disclosures to all users.

---

## 11. Security & Compliance

### 11.1 Key handling

- Keys stored in OS keychain via `safeStorage`.
- Keys not logged.
- Keys not sent to renderer (redacted form only).
- Keys never written to crash dumps (Electron crashpad config excludes them).

### 11.2 Audit obligations

For organizations under SOC 2, HIPAA, GDPR considerations:
- Each provider's compliance posture documented in Settings → Providers → "Compliance info" link.
- Anthropic + OpenAI + Deepgram + ElevenLabs are SOC 2 Type II at minimum (as of 2026-05).
- GDPR data subjects: users can purge by deleting `<userData>/bubbles.sqlite`; providers store transient data per their policies.

### 11.3 Third-party SDK auditing

CI step `pnpm audit --prod --audit-level=moderate` runs weekly + on every PR. Snyk scan supplements (free tier).

---

## 12. Lock-in Exit Plan (Theoretical)

If we ever needed to leave a vendor:

| Leaving | Replacement candidates | Effort |
|---|---|---|
| Anthropic → ??? | Self-hosted Llama 3.3 70B / DeepSeek / Mistral / Google Gemini | 2–4 engineer-weeks |
| Deepgram → ??? | AssemblyAI Universal-2; Speechmatics; Azure Speech | 1–2 weeks |
| ElevenLabs → ??? | Azure Neural; Cartesia Sonic; PlayHT | 1–2 weeks |
| Hume → ??? | self-trained on RAVDESS / IEMOCAP; or removal | 0 weeks (already optional) |
| Replicate → ??? | Fal.ai; Together AI; Banana | 1 week |
| Suno → ??? | Riffusion; Stable Audio 2 (via Stability); MusicGen | 1 week |
| Tavily → ??? | You.com; Perplexity; SerpAPI | 1 week |

The adapter pattern guarantees these are bounded changes.

---

## 13. Pricing Maintenance

Pricing fluctuates. v3 reads `pricing.json` from:
1. Bundled defaults in `apps/desktop/resources/pricing.json`.
2. Overridden by `<userData>/pricing.json` if present.
3. Optionally refreshed via Bubbles-hosted manifest at `https://bubbles.dev/v3/pricing.json` if the user opts into pricing updates (off by default).

A `pricing-refresh.yml` GitHub Action runs monthly and PRs updated pricing.

---

## 14. References

- [05-Full-AI-Integrations-Plan.md](05-Full-AI-Integrations-Plan.md) — technical adapter details.
- [03-Full-Backend-Plan.md §13](03-Full-Backend-Plan.md) — Cost meter.
- [01-Full-Functional-Requirements.md §5.3](01-Full-Functional-Requirements.md) — privacy commitments.
- [02-Full-Development-Plan.md §5](02-Full-Development-Plan.md) — risk register where vendor risks live.
