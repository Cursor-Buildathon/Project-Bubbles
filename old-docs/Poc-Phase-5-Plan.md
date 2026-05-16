# Phase 5 — UX, Voice, Permission UI

## Context

Phase 4 is complete: AgentLoop, SkillsCompiler, ToolKit, PermissionGuard, and inline permission modal all work end-to-end. The current app is functionally solid but still looks like a debug build:

- API key is entered in a raw inline form inside the chat panel — no onboarding flow.
- Chat panel is a standalone 900×640 window that opens at a default position, not anchored to the avatar.
- Agent switcher is a single cycle button (`Bubbles ▶`) with no visual preview.
- Permission modal shows raw JSON args — file writes get the same treatment as `plan_mode`.
- Conversation history is persisted to SQLite but **never loaded on relaunch** — ChatApp starts empty every time.
- Cost events are recorded but there is no cap enforcement and no spend dashboard.
- Avatar window always opens DevTools (`openDevTools({ mode: "detach" })`).
- No keyboard shortcuts; no app icon on the window.

Phase 5 polishes the user-facing surface so a stranger can operate the app without devtools. The exit gate is the original POC Definition-of-Done steps 2–7 working manually:

1. Enter MiniMax API key in a first-run wizard.
2. See Bubbles appear.
3. Type "hi" → spoken, lip-synced reply within 2 s of first token.
4. Switch to Coda → ask "make hello.txt with my name" → approve preview → file on disk.
5. Switch to Sage → thoughtful reply in Sage's voice.
6. Quit, relaunch, see prior conversation.

---

## Build Order

### 0. Seed-presets parity (½ hour)

`apps/desktop/src/main/seedPresets.ts` still writes a stub `skills.md` (frontmatter + "Friendly and helpful."). The CLI script `scripts/seed-presets.ts` already has rich per-role skills. **Copy the `buildSkillsMd` logic into the main-process seeder** so first-launch users get the same rich personalities without running the CLI first.

**Modify** `apps/desktop/src/main/seedPresets.ts`:
- Import / inline the `buildSkillsMd` function from `scripts/seed-presets.ts`.
- Replace the placeholder `skills.md` write with the rich version.
- Keep idempotency: only overwrite `skills.md` when `config.json` is missing (first seed), or add a `--force-skills` flag for development refreshes.

---

### 1. Settings Store + Project Root (Day 1, morning)

The first-run wizard needs to save: API key (already via safeStorage), **project folder**, **daily cost cap**, and **last active conversation/agent**. Extend the existing `electron-store` wrapper.

**Modify** `apps/desktop/src/main/store.ts`:
```ts
interface StoreSchema {
  avatarBounds: { x: number; y: number; width: number; height: number };
  chatPanelOpen: boolean;
  activeAgentId: string;
  projectRoot: string;            // NEW — workspace directory
  costCapUsd: number;             // NEW — default 5.0
  lastConversationId: string;     // NEW — one global last
}
```
Add getters/setters for the three new fields.

**New** `apps/desktop/src/main/projectRoot.ts` (~30 lines):
```ts
export function resolveProjectRoot(storeValue?: string): string {
  const root = storeValue ?? join(app.getPath("home"), ".bubbles", "workspace");
  mkdirSync(root, { recursive: true });
  return root;
}
```
Refactor `agentHandler.ts` to read the project root from store (instead of hardcoded `workspaceRoot()`) and pass it into `ToolContext`.

---

### 2. First-Run Wizard (Day 1, afternoon)

Replace the inline debug API-key panel with a full-screen wizard overlay.

**New** `apps/renderer/src/onboarding/OnboardingWizard.tsx` (~180 lines):
- 3 steps: **Welcome** → **API Key** → **Project Folder**.
- Step 2 validates the key by making a tiny M2.7 call before continuing (reuse `window.bubbles.debug.setApiKey` → then `window.bubbles.agent.run` with a hidden "ping" message or just call a new `v1:debug:validateKey` IPC).
- Step 3 uses a new IPC `v1:app:pickFolder` (renderer can't call `dialog` directly) which returns a path string. Default to `~/.bubbles/workspace`.
- On finish: persist `projectRoot` to store, mark onboarding complete, hide wizard.

**Modify** `apps/renderer/src/ChatApp.tsx`:
- Add `needsOnboarding` state: true when `apiKeySet === false` **or** when a new `window.bubbles.debug.needsOnboarding()` returns true.
- Render `<OnboardingWizard onComplete={...} />` as a full-screen overlay when needed.
- Remove the old inline API-key block from the main chat UI.

**New IPC** in `packages/shared-types/src/ipc.ts`:
```ts
export const NeedsOnboardingResponseSchema = z.object({
  needsOnboarding: z.boolean(),
  reason: z.enum(["no_api_key", "no_project_root"]).optional(),
});

export const PickFolderResponseSchema = z.object({
  canceled: z.boolean(),
  filePaths: z.array(z.string()),
});
```
Add channels: `APP_NEEDS_ONBOARDING`, `APP_PICK_FOLDER`.

**Modify** `apps/desktop/src/preload/index.ts` — expose `window.bubbles.app.needsOnboarding()`, `window.bubbles.app.pickFolder()`.

**Modify** `apps/desktop/src/main/ipc/debugHandler.ts` — add `APP_NEEDS_ONBOARDING` handler that returns true if `getApiKey()` throws or if `getProjectRoot()` is missing from store.

**New file** `apps/desktop/src/main/ipc/appHandler.ts` (~40 lines):
- `APP_PICK_FOLDER`: wraps `dialog.showOpenDialog({ properties: ["openDirectory"] })`.
- Also handles a `APP_GET_SETTINGS` / `APP_SET_SETTINGS` pair for the settings UI later.

---

### 3. Conversation History on Relaunch (Day 1, end)

**Modify** `apps/desktop/src/main/store.ts` — persist `lastConversationId` after each successful turn.

**Modify** `apps/desktop/src/main/ipc/agentHandler.ts`:
- After a turn completes, call `setLastConversationId(conversationId)`.
- On `AGENT_RUN`, if `req.conversationId` is missing but `getLastConversationId()` exists and matches the active agent, reuse it. *(Simpler: let the renderer pass the stored id.)*

**Modify** `apps/renderer/src/ChatApp.tsx`:
- On mount, after loading agents, call `window.bubbles.memory.query({ conversationId: <stored> })`.
- Populate the `messages` state from the DB rows.
- Map DB roles: `user`/`assistant` display normally; `tool` rows render as small `[tool: ...]` system chips (grey, italic) so the user sees what happened in prior sessions.
- Persist `conversationId` to a new `window.bubbles.app.setSetting("lastConversationId", id)` whenever a turn completes.

**Edge case**: if the user switches agents, start a new conversation for that agent (current behaviour). When switching back, load that agent's last conversation if any. For POC simplicity: store **one** global `lastConversationId` and `lastAgentId`; on relaunch load that conversation. If the user switches agents, a new conversation starts and overwrites the stored one.

---

### 4. Chat Panel Anchoring + Keyboard Shortcuts (Day 2, morning)

**Modify** `apps/desktop/src/main/windows/chatPanel.ts`:
- Add `positionChatPanel()` that reads `getAvatarBounds()`, computes a position to the **right** of the avatar (or left if off-screen), and calls `chatPanel.setPosition(x, y)`.
- Call `positionChatPanel()` inside `toggleChatPanel()` before showing.
- Call `positionChatPanel()` on avatar `moved` event so the chat panel "follows" the avatar while open.

**Modify** `apps/desktop/src/main/windows/avatar.ts`:
- Add an `on("moved", ...)` handler that, if chat panel is visible, repositions it.

**New global shortcut** in `apps/desktop/src/main/index.ts`:
```ts
import { globalShortcut } from "electron";
app.whenReady().then(() => {
  globalShortcut.register("CommandOrControl+Space", () => {
    toggleChatPanel();
  });
});
```
Unregister on `will-quit`.

**Modify** `apps/renderer/src/ChatApp.tsx`:
- Add `useEffect` keydown listener for `Escape` → call a new `window.bubbles.app.closeChat()` IPC (or reuse `toggleChatPanel` via a renderer→main message).

---

### 5. Agent Switcher Redesign (Day 2, afternoon)

Replace the cycle button with a dropdown/card panel.

**New** `apps/renderer/src/agents/AgentSwitcher.tsx` (~100 lines):
- Trigger button shows current agent name + a small coloured dot (tint).
- Dropdown panel shows 3 cards: Bubbles, Coda, Sage.
- Each card shows: name, role description ("General assistant", "Coding partner", "Research analyst"), and a tinted sprite preview (reuse a static PNG from the atlas or a simple coloured div).
- On click: calls `window.bubbles.agent.setSkin(id)`, saves active agent, closes dropdown.

**Modify** `apps/renderer/src/ChatApp.tsx` — replace the inline cycle button with `<AgentSwitcher />` in the header.

**Modify** `apps/desktop/src/main/store.ts` — `setActiveAgentId` is already called when switching; ensure `ChatApp` reads it on mount and sets the correct initial `activeAgentIdx`.

---

### 6. Daily Cost Cap + Spend Dashboard (Day 3)

**Modify** `apps/desktop/src/main/store.ts` — add `costCapUsd` (default `5.0`).

**Modify** `apps/desktop/src/main/ipc/agentHandler.ts`:
- Before calling `runAgentLoop`, query today's spend via `getDailySummary(db, 1)`.
- If `todaySpend >= costCapUsd`, return early with:
  ```ts
  return {
    turnId,
    conversationId,
    status: "error",
    error: "I've hit today's spend cap. You can raise the limit in Settings.",
  };
  ```
- Do not call MiniMax; do not record cost.

**New** `apps/renderer/src/settings/SpendDashboard.tsx` (~80 lines):
- Fetches spend data via new IPC `v1:settings:getSpendSummary`.
- Shows 3 cards: Today / Last 7 days / Last 30 days.
- Shows a progress bar for today's spend vs cap.
- Includes an input to change the daily cap (calls `v1:settings:setCostCap`).

**New IPC schemas** in `packages/shared-types/src/ipc.ts`:
```ts
export const SpendSummaryRequestSchema = z.object({ days: z.number().int().positive().default(7) });
export const SpendSummaryResponseSchema = z.object({
  days: z.array(z.object({ date: z.string(), totalCostUsd: z.number(), totalInputTokens: z.number(), totalOutputTokens: z.number() })),
  capUsd: z.number(),
});
```

**Modify** `apps/desktop/src/main/ipc/appHandler.ts` — add `SETTINGS_GET_SPEND` and `SETTINGS_SET_CAP` handlers.

**Modify** `apps/renderer/src/ChatApp.tsx` — add a small gear/settings icon in the header that opens the Spend Dashboard in a modal.

---

### 7. Permission Modal Enhancement (Day 4, morning)

**Modify** `apps/renderer/src/PermissionModal.tsx` (~150 lines):
- Add tool-specific rendering:
  - **`writeFile`**: if the file already exists, read its current content via a new IPC `v1:file:peek` and show a simple side-by-side diff (old vs new) using `<pre>` blocks with colour highlighting (red removal, green addition). If the file is new, show "Create new file" with the content preview.
  - **`plan_mode`**: render the steps as an ordered list instead of raw JSON.
  - **`readFile`/`listDir`**: these shouldn't appear (auto-approved), but if they do, show a clean summary.
- Add agent name and a timestamp to the header.
- Keep the same `Allow / Deny / Always Allow` actions.

**New IPC** `v1:file:peek` in `apps/desktop/src/main/ipc/appHandler.ts`:
```ts
ipcMain.handle("v1:file:peek", (_evt, raw) => {
  const { path } = z.object({ path: z.string() }).parse(raw);
  const fullPath = resolveScopedPath(projectRoot, path);
  if (!existsSync(fullPath)) return { exists: false, content: "" };
  const content = readFileSync(fullPath, "utf-8");
  return { exists: true, content: content.slice(0, 2000) }; // truncate for preview
});
```
Expose via preload.

---

### 8. Tool-Call Chips + Error Toasts (Day 4, afternoon)

**Modify** `apps/renderer/src/ChatApp.tsx`:
- When a stream chunk carries `toolCall`, render a small pill above the assistant message: `🔧 plan_mode`.
- When `toolResult` arrives, update the pill to `✅ plan_mode` or `❌ plan_mode`.
- Style: `bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1`.

**New** `apps/renderer/src/components/Toast.tsx` (~50 lines):
- Simple stack of toast notifications (auto-dismiss 4 s).
- Used for: "API key saved", "File written", "Cost cap reached", generic errors.

**Modify** `apps/renderer/src/ChatApp.tsx` — replace the inline error message insertion with a toast. Keep the error message in the chat stream too, but make it visually distinct (red bubble).

---

### 9. Remove DevTools + App Icon + Packaging Prep (Day 5)

**Modify** `apps/desktop/src/main/windows/avatar.ts`:
```ts
if (!app.isPackaged) {
  avatarWindow.webContents.openDevTools({ mode: "detach" });
}
```

**Modify** `apps/desktop/src/main/windows/chatPanel.ts`:
- Add `icon: getAppIconPath()` to `BrowserWindow` constructor options.

**New** `apps/desktop/src/main/icon.ts` (~20 lines):
```ts
export function getAppIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "assets", "tray", "tray.png");
  }
  return join(__dirname, "../../../../assets/tray/tray.png");
}
```
Reuse for both window icon and tray.

**Modify** `apps/desktop/package.json`:
- Add `"package:win": "pnpm build && electron-builder --win nsis"` script.
- Add `win.icon` and `nsis` config pointing to an icon file (generate a `.ico` from `assets/tray/tray.png` or create a higher-res source).

**Modify** `apps/desktop/src/main/tray.ts`:
- Add a **Keyboard Shortcuts** menu item that shows a small native message box: `Ctrl+Space = Open Chat, Esc = Close Chat, Drag avatar to move, Click avatar to toggle chat.`

---

## Critical Files

### Created
| Path | Purpose |
|------|---------|
| `apps/renderer/src/onboarding/OnboardingWizard.tsx` | 3-step first-run wizard |
| `apps/renderer/src/agents/AgentSwitcher.tsx` | Visual agent picker with cards |
| `apps/renderer/src/settings/SpendDashboard.tsx` | Today/7d/30d spend + cap editor |
| `apps/renderer/src/components/Toast.tsx` | Toast notification stack |
| `apps/desktop/src/main/ipc/appHandler.ts` | `pickFolder`, `getSettings`, `setSettings`, `peekFile` |
| `apps/desktop/src/main/projectRoot.ts` | Resolve workspace root from store or default |
| `apps/desktop/src/main/icon.ts` | Cross-env app icon path resolver |

### Modified
| Path | Change |
|------|--------|
| `apps/desktop/src/main/store.ts` | Add `projectRoot`, `costCapUsd`, `lastConversationId` |
| `apps/desktop/src/main/seedPresets.ts` | Rich `skills.md` from `buildSkillsMd` |
| `apps/desktop/src/main/index.ts` | Register `appHandler`, global shortcuts |
| `apps/desktop/src/main/windows/avatar.ts` | DevTools gated; emit position on move |
| `apps/desktop/src/main/windows/chatPanel.ts` | Anchor to avatar; add icon |
| `apps/desktop/src/main/ipc/agentHandler.ts` | Read projectRoot from store; cost-cap check; persist conversation id |
| `apps/desktop/src/main/ipc/debugHandler.ts` | Add `needsOnboarding` handler |
| `apps/desktop/src/main/ipc/permissionRouter.ts` | No changes needed |
| `apps/desktop/src/preload/index.ts` | Expose `app.*`, `settings.*`, `file.peek` |
| `packages/shared-types/src/ipc.ts` | `NeedsOnboarding`, `PickFolder`, `SpendSummary`, `Settings` schemas + channels |
| `apps/renderer/src/ChatApp.tsx` | Load history; wizard overlay; tool chips; toasts; settings gear |
| `apps/renderer/src/PermissionModal.tsx` | Tool-specific previews (diff for writes, list for plans) |
| `apps/desktop/package.json` | Add `package:win` script; icon config |

---

## Verification

Run `pnpm dev:desktop` after each day.

### After Day 1
1. Delete `~/.bubbles/agents/` and relaunch → first-run wizard appears.
2. Complete wizard (enter key, pick folder) → chat panel becomes usable.
3. Type "hello" → reply streams, TTS plays.
4. Quit, relaunch → wizard is skipped; prior "hello" conversation loads in the chat panel.

### After Day 2
5. Drag avatar to bottom-right of screen → click avatar → chat panel opens anchored to the right of the avatar.
6. Press `Ctrl+Space` → chat panel toggles.
7. Click agent switcher → dropdown shows 3 cards with names and tint dots → select Coda → avatar tint switches to blue.

### After Day 3
8. In Spend Dashboard, set cap to `$0.01` → send any message → agent replies with "I've hit today's spend cap..." (no MiniMax call made).
9. Reset cap to `$5` → send "hi" → works normally.
10. Dashboard shows today's spend > 0.

### After Day 4
11. Switch to Coda → send "make todo.md with a task list" → permission modal for `plan_mode` shows steps as a numbered list (not raw JSON).
12. Approve → `writeFile` modal shows diff preview: left side "File does not exist", right side the new content.
13. Deny a write → red toast "File write denied" appears; chat message explains the denial.

### After Day 5
14. `pnpm package:win` completes without errors and produces a `.exe` in `apps/desktop/release/`.
15. No devtools window opens when running the packaged build.
16. Tray menu shows **Keyboard Shortcuts** item.

### Phase 5 Exit Gate
All 7 DoD steps verified manually:
- [ ] First-run wizard: key + folder, no devtools needed.
- [ ] Bubbles appears on desktop, idles, click opens chat.
- [ ] "hi" → spoken reply within 2 s.
- [ ] Switch to Coda → write file → approve → file on disk.
- [ ] Switch to Sage → distinct thoughtful reply.
- [ ] Quit, relaunch → prior conversation visible.
- [ ] Cost cap blocks spend when exceeded.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `dialog.showOpenDialog` not available before `app.whenReady()` | Only invoke from IPC handlers (ready has fired). |
| Cost-cap query adds a DB round-trip to every turn | Query is a single indexed `SUM()` on `cost_events`; < 1 ms. |
| Diff preview for large files is slow | Cap peek at 2 000 chars; truncate with "…" indicator. |
| Chat panel repositioning flickers | Set position while window is still hidden, then `.show()`. |
| Global shortcut `Ctrl+Space` may conflict with OS shortcut | Document in tray menu; user can click avatar as fallback. |
| Packaged build missing assets | `electron-builder` `extraResources` already maps `../../assets` → `assets`; verify with a smoke install. |
