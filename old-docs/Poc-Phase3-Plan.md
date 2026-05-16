# Phase 3 — Avatar & Pixel Pet — Implementation Plan

## Context

Phases 1 & 2 are complete: monorepo + tooling + Electron app + IPC + MiniMax chat/TTS + SQLite memory all working. The single 900×640 chat window is the only UI today. Phase 3 of `docs/my-idea-is-called-fluffy-torvalds-PoC-dev-plan.md` brings the **pixel-art avatar to life on the desktop** using the assets the user just delivered at `bubbles-base/`.

**Asset reality check.** `bubbles-base/final/spritesheet.png` is a 1536×1872 atlas of 192×208 cells, 8 cols × 9 rows, with 9 animation states (`idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`). Layout fully described in `bubbles-base/pet_request.json`. There is no explicit `talk` or `blink` row — talking is faked via amplitude-driven sprite scaling on the idle row. Only Bubbles base art exists; Coda/Sage will reuse the same atlas with runtime PixiJS tints.

**User-confirmed design choices.**
1. Two-window architecture per dev plan: a transparent always-on-top **AvatarWindow** + the existing chat window converted into a **ChatPanelWindow**.
2. **Amplitude-driven vertical scale on the idle row** for lip-sync (no new art).
3. **Bubbles + tinted palette swaps**: register Bubbles, Coda (blue tint), Sage (green tint) all sharing the one spritesheet; switch tint per active agent.

---

## Plan

### 3.0 Asset bootstrap

- Create `assets/sprites/bubbles/`. Copy `bubbles-base/final/spritesheet.png` → `assets/sprites/bubbles/spritesheet.png` (canonical source for `seed-presets`).
- Author `assets/sprites/bubbles/spritesheet.json` — a small custom manifest (does **not** need to be Aseprite-format since we control the loader). Shape:
  ```json
  {
    "atlas": { "width": 1536, "height": 1872, "cellWidth": 192, "cellHeight": 208 },
    "animations": {
      "idle":          { "row": 0, "frameCount": 6, "frameDurationMs": 120 },
      "running-right": { "row": 1, "frameCount": 8, "frameDurationMs": 80 },
      "running-left":  { "row": 2, "frameCount": 8, "frameDurationMs": 80 },
      "waving":        { "row": 3, "frameCount": 4, "frameDurationMs": 130 },
      "jumping":       { "row": 4, "frameCount": 5, "frameDurationMs": 100 },
      "failed":        { "row": 5, "frameCount": 8, "frameDurationMs": 110 },
      "waiting":       { "row": 6, "frameCount": 6, "frameDurationMs": 140 },
      "running":       { "row": 7, "frameCount": 6, "frameDurationMs": 90 },
      "review":        { "row": 8, "frameCount": 6, "frameDurationMs": 130 }
    }
  }
  ```
- Also drop the spritesheet into `apps/renderer/public/sprites/bubbles/` (and the JSON beside it) so Vite serves it at `/sprites/bubbles/spritesheet.png` during dev. The `assets/` copy remains the source of truth that `seed-presets.ts` writes to `~/.bubbles/agents/`.
- Tray icon: extract or downscale `bubbles-base/decoded/idle.png` to a 16×16 / 32×32 PNG at `assets/tray/tray.png`.

### 3.1 AvatarWindow + ChatPanelWindow split (Day 1)

- **Add dep** `electron-store` to `apps/desktop/package.json`.
- **New** `apps/desktop/src/main/store.ts` — typed wrapper exposing `getAvatarBounds()`, `setAvatarBounds(b)`, `getChatPanelOpen()`, `setChatPanelOpen(b)`.
- **New** `apps/desktop/src/main/windows/avatar.ts` — `createAvatarWindow()`:
  - `frame: false, transparent: true, alwaysOnTop: true, resizable: false, skipTaskbar: true, hasShadow: false`
  - 256×256, default position centred on primary display unless `store` has a saved bounds
  - Loads renderer with `?window=avatar` query (Vite dev URL or `index.html` in prod)
  - Default: `setIgnoreMouseEvents(true, { forward: true })` — click-through enabled. Pixi sends `v1:avatar:setIgnoreMouse` on hover-in/out so clicks on the actual sprite alpha land on the window.
  - Persists bounds on `move`/`resize` via the store wrapper.
- **New** `apps/desktop/src/main/windows/chatPanel.ts` — extracted from current `createWindow()` in `apps/desktop/src/main/index.ts`. Same content as today's window; loaded with `?window=chat`. Hidden by default; toggle on avatar click.
- **Refactor** `apps/desktop/src/main/index.ts`:
  - Replace `createWindow()` call with `createAvatarWindow()` + lazy `createChatPanelWindow()` on first toggle.
  - Don't quit on `window-all-closed` for macOS-style behaviour; on Windows keep the current quit-on-all-closed.
- **New** `apps/desktop/src/main/tray.ts` — `createTray()`:
  - `nativeImage.createFromPath(path.join(...,'assets/tray/tray.png'))`
  - Menu items: **Show/Hide Bubbles**, **Open Chat**, **Quit**.

### 3.2 PixiJS sprite engine (Day 2)

- **Add dep** `pixi.js: ^8.x` to `apps/renderer/package.json`.
- **New** `apps/renderer/src/avatar/SpriteAtlasLoader.ts` — loads PNG + manifest JSON, slices the atlas into a `Map<animationName, Texture[]>` using `Rectangle` + `Texture.from`. Cache-keyed by atlas URL.
- **New** `apps/renderer/src/avatar/SpriteEngine.ts` — owns the `PIXI.Application`. Constructor takes a host `<canvas>`. Configured with `resolution: window.devicePixelRatio, autoDensity: true, backgroundAlpha: 0, antialias: false`, and on the renderer set `roundPixels: true` + `SCALE_MODES.NEAREST` for crisp pixel art at integer scales.
- **New** `apps/renderer/src/avatar/Character.ts` — public API:
  - `playAnimation(name, opts?: { loop?: boolean; onComplete?: () => void })`
  - `setSkin(skinId)` — for Phase 3 this just swaps the atlas if skinId points to a different sheet (today they all share, but the API is ready)
  - `setTint(0xRRGGBB)` — applied to the `AnimatedSprite`'s `.tint` for Coda/Sage palette swaps
  - `setMood(mood)` — delegates to `MoodController`
  - `setAmplitudeScale(rms: number)` — `sprite.scale.y = baseScale * (1 + rms * 0.15)`; clamps via the existing amplitude in [0,1]
  - Wraps `PIXI.AnimatedSprite` internally; uses anchor `(0.5, 1.0)` so amplitude-scale grows from the feet (avatar doesn't bobble around).
- Pixi interactivity: a single `Sprite` covering the canvas is set `eventMode: 'static'`. On `pointerover` → call preload `window.bubbles.avatar.setIgnoreMouse(false)`. On `pointerout` → `setIgnoreMouse(true)`. This is the alpha-mask hit-test the dev plan calls for, achieved via Pixi's pixel-perfect interactivity rather than custom raster-walking.

### 3.3 Mood mapping + lip-sync (Day 3–4)

- **New** `apps/renderer/src/avatar/MoodController.ts` — pure mapping table (no Pixi knowledge):
  ```
  idle        → 'idle'    (loop)
  listening   → 'review'  (loop)
  thinking    → 'waiting' (loop)
  talking     → 'idle'    (loop) + amplitude scaling enabled
  greeting    → 'waving'  (one-shot, then 'idle')
  celebrating → 'jumping' (one-shot, then 'idle')
  error       → 'failed'  (one-shot, then 'idle')
  ```
  Exposes `apply(character, mood)`. Talking explicitly opts the character into amplitude scaling; everything else disables it.
- **New** `apps/renderer/src/avatar/LipSync.ts` — subscribes to `window.bubbles.audio.onAmplitude(cb)`; calls `character.setAmplitudeScale(rms)` if mood is `talking`. Smooths via simple low-pass: `displayed = displayed * 0.7 + incoming * 0.3` to avoid jitter.
- **New schema** in `packages/shared-types/src/ipc.ts`:
  - `MoodSchema = z.enum(['idle','listening','thinking','talking','greeting','celebrating','error'])`
  - `AvatarSetMoodPayloadSchema = z.object({ mood: MoodSchema })`
  - `AvatarSetIgnoreMousePayloadSchema = z.object({ ignore: z.boolean() })`
  - Add channels to `IPC_CHANNELS`: `AVATAR_SET_MOOD: 'v1:avatar:setMood'`, `AVATAR_SET_IGNORE_MOUSE: 'v1:avatar:setIgnoreMouse'`, `AUDIO_AMPLITUDE_BROADCAST: 'v1:audio:amplitudeBroadcast'`.
- **Wire mood IPC** in main process:
  - In `apps/desktop/src/main/ipc/agentHandler.ts`, emit mood transitions: `'thinking'` when chat starts → `'talking'` when first audio chunk plays → `'idle'` after stream completes (via `webContents.send('v1:avatar:setMood', ...)` to the avatar window).
  - Currently the chat window plays audio + computes amplitude and posts `v1:audio:amplitude` to main. Today main ignores it. **New behaviour:** `apps/desktop/src/main/ipc/audioHandler.ts` (new) listens to the existing `v1:audio:amplitude` channel and re-broadcasts via `BrowserWindow.getAllWindows().forEach(w => w.webContents.send('v1:audio:amplitudeBroadcast', payload))` so the avatar window receives it.
- **Preload additions** in `apps/desktop/src/preload/index.ts`:
  - `window.bubbles.avatar.onMoodChange(cb)`
  - `window.bubbles.avatar.setIgnoreMouse(ignore: boolean)`
  - `window.bubbles.audio.onAmplitude(cb)` (subscribes to broadcast channel — distinct from existing renderer→main `audio.sendAmplitude`)

### 3.4 Renderer routing — split entry into AvatarApp + ChatApp

- **Refactor** `apps/renderer/src/main.tsx`: read `?window=` query param; mount `<AvatarApp/>` for `avatar`, `<ChatApp/>` for `chat` (default).
- **New** `apps/renderer/src/AvatarApp.tsx` — single full-bleed `<canvas>`, instantiates `SpriteEngine` + `Character`, calls `MoodController` on `onMoodChange`, runs `LipSync` on `onAmplitude`. Plays `idle` on mount.
- **Rename** `apps/renderer/src/App.tsx` → `apps/renderer/src/ChatApp.tsx` (no behavioural change). Adjust the new `main.tsx` import.

### 3.5 Filesystem-loaded agent presets (Day 5)

- **New** `scripts/seed-presets.ts` — already referenced in root `package.json` script `seed-presets`, currently missing. Implement:
  - Source: `assets/sprites/bubbles/` and `assets/sprites/presets.json` (a small file that lists `bubbles`, `coda` (tint `0x6FB3FF`), `sage` (tint `0x9CD17B`)).
  - Target: `~/.bubbles/agents/<id>/{config.json, skills.md, sprites/spritesheet.png, sprites/spritesheet.json}`.
  - Idempotent — if `~/.bubbles/agents/<id>/config.json` already exists, skip that agent.
  - Generates a placeholder `skills.md` per agent (frontmatter only — full personality/skills compilation is Phase 4).
- **Auto-seed on app start**: in `apps/desktop/src/main/index.ts`, before window creation, check if `~/.bubbles/agents/` is empty/missing → spawn the seed logic in-process (extract the core into a callable function `seedPresets()` so it can be invoked both from `tsx scripts/seed-presets.ts` CLI and from main).
- **New** `packages/agent-runtime/src/AgentRegistry.ts` — replace the `hello()` stub with:
  - `listAgents(): Promise<AgentSummary[]>` — scans `~/.bubbles/agents/`, parses each `config.json` with a Zod schema (`AgentConfigSchema = z.object({ id, name, tint: z.number().int(), atlas: z.string(), defaultMood: MoodSchema.default('idle') })`), returns the list.
  - `getAgent(id)` — returns one entry or `null`.
- **New IPC channel** `v1:agent:list` (invoke). Handler in `apps/desktop/src/main/ipc/agentHandler.ts` returns `AgentRegistry.listAgents()`. Preload exposes `window.bubbles.agent.list()`.
- **Avatar reads active agent** from chat window's selection. Phase 3 minimum: `AvatarApp` calls `agent.list()` on mount, picks the first (Bubbles) by default; chat window adds a tiny dropdown/cycle button that posts `v1:avatar:setSkin` (new IPC) which forwards to the avatar window — `setTint` is applied via `Character.setTint(config.tint)`.

### 3.6 Custom protocol for runtime sprite paths — defer

For Phase 3 the avatar loads sprites from `/sprites/bubbles/spritesheet.png` (Vite's `public/`). The seed-presets script populates `~/.bubbles/agents/` for *future* phases, but the renderer does **not** read from there yet — that swap (custom `bubbles://` protocol or similar) lands when AgentRegistry is fully load-bearing in Phase 4. Keeps Phase 3 scope honest.

---

## Critical files (paths)

**Create**
- `assets/sprites/bubbles/spritesheet.png` (copy of `bubbles-base/final/spritesheet.png`)
- `assets/sprites/bubbles/spritesheet.json` (custom manifest above)
- `assets/sprites/presets.json` (Bubbles/Coda/Sage definitions)
- `assets/tray/tray.png`
- `apps/renderer/public/sprites/bubbles/spritesheet.png` + `.json` (dev-server copy)
- `apps/desktop/src/main/store.ts`
- `apps/desktop/src/main/tray.ts`
- `apps/desktop/src/main/protocol.ts` *(stub, used in Phase 4)*
- `apps/desktop/src/main/windows/avatar.ts`
- `apps/desktop/src/main/windows/chatPanel.ts`
- `apps/desktop/src/main/ipc/audioHandler.ts`
- `apps/desktop/src/main/seedPresets.ts` (extracted core)
- `apps/renderer/src/AvatarApp.tsx`
- `apps/renderer/src/ChatApp.tsx` (rename of `App.tsx`)
- `apps/renderer/src/avatar/SpriteEngine.ts`
- `apps/renderer/src/avatar/SpriteAtlasLoader.ts`
- `apps/renderer/src/avatar/Character.ts`
- `apps/renderer/src/avatar/MoodController.ts`
- `apps/renderer/src/avatar/LipSync.ts`
- `packages/agent-runtime/src/AgentRegistry.ts` (replaces `index.ts` stub)
- `scripts/seed-presets.ts`

**Modify**
- `apps/desktop/package.json` — add `electron-store`
- `apps/desktop/src/main/index.ts` — split window creation, register tray, register protocol stub, call seed
- `apps/desktop/src/preload/index.ts` — add `avatar.*` and `audio.onAmplitude` surface
- `apps/desktop/src/main/ipc/agentHandler.ts` — emit mood transitions; handle `v1:agent:list`
- `apps/renderer/package.json` — add `pixi.js`
- `apps/renderer/src/main.tsx` — query-string router
- `packages/shared-types/src/ipc.ts` — `MoodSchema`, new channels, new payload schemas
- `packages/shared-types/src/agent.ts` — add `AgentConfigSchema` (for filesystem `config.json`)

**Reuse (existing utilities)**
- `packages/shared-logger/src/index.ts` — `createLogger("avatar")`, `createLogger("tray")`, `withTurnId(...)` for any per-turn mood transitions
- `packages/shared-types/src/ipc.ts` `IPC_CHANNELS` constant — extend rather than replace
- Existing `v1:audio:amplitude` channel from `apps/desktop/src/preload/index.ts:audio.sendAmplitude` — already wired chat→main; Phase 3 only adds the main→all-windows broadcast hop on top
- `apps/desktop/src/main/ipc/agentHandler.ts` already handles `v1:agent:run` end-to-end — just inject mood emissions at the right lifecycle points

---

## Verification

**Boot smoke (manual):**
1. `pnpm install` (one-time, picks up `pixi.js` + `electron-store`).
2. `pnpm dev:desktop` — Electron boots in <3 s.
3. AvatarWindow appears: transparent, frameless, always-on-top, no taskbar entry. Idle animation loops smoothly at integer scaling (no blur).
4. Click on a transparent area of the avatar canvas → focus stays on the window underneath (alpha hit-test working).
5. Click on the visible sprite → ChatPanel opens, anchored next to avatar.
6. Tray icon present in system tray; right-click menu shows **Show/Hide Bubbles**, **Open Chat**, **Quit**.

**End-to-end conversation (Phase 3 exit gate):**
7. Enter MiniMax key (already wired) → type "hello" in chat panel.
8. Avatar transitions: `idle` → `thinking` (uses `waiting` row) during chat streaming.
9. When TTS audio plays: avatar switches to `talking` (idle row + amplitude-scaled vertical squish in time with the audio envelope).
10. After TTS completes: avatar returns to `idle`.

**Multi-preset:**
11. Cycle agent in chat panel → avatar tint changes between Bubbles (no tint) → Coda (blue) → Sage (green). Same atlas underneath.

**Persistence:**
12. Drag avatar to second monitor → quit → relaunch. Avatar reappears at the saved bounds.

**Filesystem layout:**
13. After first launch, `~/.bubbles/agents/` exists with `bubbles/`, `coda/`, `sage/` subdirs, each containing `config.json`, `skills.md`, `sprites/spritesheet.png`, `sprites/spritesheet.json`.

**Automated:**
14. `pnpm typecheck` green.
15. `pnpm lint` green.
16. `pnpm test` green — new unit tests:
    - `MoodController` mapping table is exhaustive (one test per mood enum value).
    - `Character.setAmplitudeScale` clamps and applies expected `scale.y`.
    - `AgentRegistry.listAgents` parses fixtures correctly; rejects malformed `config.json` with a clear error.
    - Zod schemas (`MoodSchema`, `AgentConfigSchema`) round-trip the canonical fixture.
17. Visual regression: capture baselines for 4 moods × 1 agent (12 baselines after Phase 3 if all 3 agents are exercised) — only requires Bubbles in this phase. Add a Playwright spec that boots the avatar window with each mood injected via IPC and screenshots the canvas.

**Coverage / hygiene:**
18. `pnpm test:coverage` ≥ 70% on packages newly touched (`shared-types`, `agent-runtime`). The avatar logic in `apps/renderer` is not part of the package coverage target per dev plan §1.8.

---

## Risks & explicit non-goals (Phase 3)

- **Talking realism is intentionally limited** — amplitude-scale is a fake mouth, not a real lip-sync. Real mouth-frame animation is deferred until proper "talk" art exists.
- **Agent switching UI is minimal** — a cycle button or simple dropdown in the chat panel is enough; full agent switcher with sprite previews is Phase 5 (3.5 of dev plan handled this minimally).
- **No SkillsCompiler this phase** — `skills.md` placeholders are written by `seed-presets`, but nothing reads them yet (Phase 4).
- **Custom `bubbles://` protocol stays a stub** — wired in Phase 4 when the registry actually drives runtime asset loading.
- **No new MiniMax cost** — Phase 3 adds zero API calls; same chat/TTS flow as Phase 2, just with extra UI.
