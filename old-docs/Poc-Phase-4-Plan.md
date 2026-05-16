# Phase 4 — Agent Brain & Tools

## Context

Phase 3 of the Bubbles POC is complete: the avatar window, sprite engine, mood controller, agent registry, and basic chat IPC flow all work. The current `agentHandler.ts` sends user text to MiniMax via `streamChat`, streams text deltas back to the renderer, persists messages, plays TTS, and records cost — but it has **no tool support, no permission gating, and uses a hardcoded system prompt** regardless of which agent (Bubbles / Coda / Sage) the user picked.

Phase 4 adds the actual "agent brain": each agent's personality and capabilities are compiled from its own `skills.md`, the LLM can call tools (read files, write files, list dirs, draft plans), and every tool call that mutates state goes through a permission gate with an inline approval modal.

**Phase 4 exit gate** (from the dev plan):
1. "what's 2+2?" → text reply persisted to DB (already works, but needs to go through AgentLoop)
2. "make hello.txt with my name" via **Coda** → permission preview blocks → approve in chat panel → file appears on disk

**User-confirmed scope decisions**:
- Permission UI: minimal inline modal inside the existing chat panel (no separate window, no Monaco diff viewer — that's Phase 5).
- Built-in tools: `readFile`, `writeFile`, `listDir`, `plan_mode` (4 tools).
- LLM-judge evaluation: skipped — manual verification of the exit gate only.

---

## Build Order

Bottom-up so each layer compiles cleanly:

1. `shared-types` — add permission/tool IPC schemas + tool-call types
2. `minimax-client` — patch SSE parser to yield `tool_calls`
3. `tool-kit` — implement Tool interface, registry, 4 built-ins, `zod-to-json-schema` install
4. `permission-guard` — implement `Guard.review()` with policy cascade
5. `agent-runtime` — implement `SkillsCompiler` + `AgentLoop`
6. `apps/desktop/main` — refactor `agentHandler.ts` to use `AgentLoop`, add permission router
7. `apps/desktop/preload` — expose permission surface
8. `apps/renderer` — `PermissionModal` inside `ChatApp.tsx`
9. `scripts/seed-presets.ts` — write richer `skills.md` for the 3 presets, plus a `~/.bubbles/workspace/` scaffold

---

## 1. `@bubbles/shared-types` — new schemas

**Modify** [packages/shared-types/src/ipc.ts](packages/shared-types/src/ipc.ts) (current: 142 lines).

Add:

```ts
// v1:permission:request — main → renderer (chat panel)
export const PermissionRequestSchema = z.object({
  callId: z.string().uuid(),
  turnId: z.string().uuid(),
  agentId: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
  description: z.string(),
});
export type PermissionRequest = z.infer<typeof PermissionRequestSchema>;

// v1:permission:respond — renderer → main
export const PermissionResponseSchema = z.object({
  callId: z.string().uuid(),
  approved: z.boolean(),
  remember: z.boolean().default(false),
});
export type PermissionResponse = z.infer<typeof PermissionResponseSchema>;
```

Extend `IPC_CHANNELS`:
```ts
PERMISSION_REQUEST: "v1:permission:request",
PERMISSION_RESPOND: "v1:permission:respond",
```

**Modify** [packages/shared-types/src/message.ts](packages/shared-types/src/message.ts) — verify `ToolCallSchema` exists; if not, add:
```ts
export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.string(), // JSON string from MiniMax
});
```

Extend `AgentStreamChunkSchema` (in ipc.ts) to optionally carry tool-call notifications for the UI:
```ts
toolCall: z.object({ name: z.string(), args: z.record(z.unknown()) }).optional(),
toolResult: z.object({ name: z.string(), ok: z.boolean(), preview: z.string() }).optional(),
```

---

## 2. `@bubbles/minimax-client` — tool-call parsing

**Modify** [packages/minimax-client/src/chat.ts](packages/minimax-client/src/chat.ts) (current: 125 lines, key fn `parseSseLine` at line 36, `streamChat` at line 72).

The current parser only extracts `delta.content`. MiniMax M2.7 emits `delta.tool_calls[]` chunks when the model decides to call a tool — these accumulate across multiple SSE events (the `arguments` JSON is streamed character-by-character) and finalize when `finish_reason: "tool_calls"` arrives.

Add to `ChatChunk`:
```ts
export interface ChatChunk {
  text: string;
  toolCallDeltas?: Array<{ index: number; id?: string; name?: string; argsDelta?: string }>;
  finishReason?: string;
  usage?: { ... };
}
```

Update `parseSseLine` (around lines 41-62) to also read `choice.delta.tool_calls[]` and emit `toolCallDeltas`. Don't try to finalize here — the caller (AgentLoop) accumulates by `index`.

**Switch the default model** at line 86: `opts.model ?? "MiniMax-Text-01"` should likely become `"MiniMax-M1"` or `"abab6.5s-chat"` — the current `"MiniMax-Text-01"` is the older model and may not support `tools` reliably. **Risk:** verify with a quick test which MiniMax model in the user's tier supports the `tools` array. If unsure, ship with current default but add a comment + TODO.

Add a co-located test extending [packages/minimax-client/src/index.test.ts](packages/minimax-client/src/index.test.ts) with a mocked SSE stream that emits `tool_calls` deltas and asserts they are forwarded.

---

## 3. `@bubbles/tool-kit` — Tool interface + 4 built-ins

**Currently a 4-line stub.** Build out:

**`packages/tool-kit/package.json`** — add dep `zod-to-json-schema@^3`.

**`packages/tool-kit/src/Tool.ts`** (~40 lines):
```ts
import type { z } from "zod";

export interface ToolContext {
  projectRoot: string;
  turnId: string;
  agentId: string;
  planApproved?: boolean; // set true after plan_mode approval within same turn
}

export interface Tool<TParams extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: TParams;
  requiresApproval: boolean;
  invoke(args: z.infer<TParams>, ctx: ToolContext): Promise<ToolResult>;
}

export interface ToolResult {
  ok: boolean;
  content: string; // JSON or human-readable result fed back to model
  preview?: string; // short summary for UI / logs
}
```

**`packages/tool-kit/src/registry.ts`** (~80 lines):
```ts
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  forAgent(whitelist: string[]): Tool[];
  toMiniMaxToolDefs(whitelist: string[]): ToolDef[]; // via zod-to-json-schema
}
export function createDefaultRegistry(): ToolRegistry; // registers all 4 built-ins
```

`toMiniMaxToolDefs` uses `zodToJsonSchema(tool.parameters, { target: "openApi3" })` to produce the `function.parameters` JSON Schema MiniMax expects.

**`packages/tool-kit/src/readFile.ts`** (~40 lines): `parameters = z.object({ path: z.string() })`, `requiresApproval: false`. Resolves path relative to `ctx.projectRoot`, rejects paths escaping the root (use `path.resolve` + prefix check). Reads UTF-8, returns content (truncated to 50KB).

**`packages/tool-kit/src/writeFile.ts`** (~40 lines): `parameters = z.object({ path: z.string(), content: z.string() })`, `requiresApproval: true`. Same root-scoping. Creates parent dirs.

**`packages/tool-kit/src/listDir.ts`** (~30 lines): `parameters = z.object({ path: z.string().default(".") })`, `requiresApproval: false`. Returns sorted list of entries with `{name, type: "file" | "dir"}`.

**`packages/tool-kit/src/planMode.ts`** (~50 lines): `parameters = z.object({ steps: z.array(z.string()).min(1) })`, `requiresApproval: true`. Result includes `ok: true, content: "<plan approved>"`. AgentLoop reads the result and sets `ctx.planApproved = true` so subsequent `writeFile` calls in the same turn skip the approval modal.

Co-locate `*.test.ts` for each.

---

## 4. `@bubbles/permission-guard` — Guard.review()

**Currently a 4-line stub.**

**`packages/permission-guard/src/Guard.ts`** (~130 lines):

```ts
export interface ReviewCtx {
  agentId: string;
  turnId: string;
  webContents: WebContents; // to emit permission:request
  db: Db;
}

export interface Decision {
  approved: boolean;
  remember: boolean;
}

export class PermissionGuard {
  private pending = new Map<string, (d: Decision) => void>();

  async review(
    tool: Tool,
    args: Record<string, unknown>,
    ctx: ReviewCtx,
  ): Promise<Decision> {
    // 1. tool.requiresApproval=false → auto-allow, log & return
    if (!tool.requiresApproval) {
      insertPermission(ctx.db, { ..., decision: "allow", payloadHash: hash(args) });
      return { approved: true, remember: false };
    }

    // 2. lookup remembered allow_always → auto-allow
    const remembered = lookupPermission(ctx.db, tool.name, hash(args));
    if (remembered?.decision === "allow_always") {
      return { approved: true, remember: true };
    }

    // 3. emit permission:request, wait for response
    const callId = randomUUID();
    return new Promise((resolve) => {
      this.pending.set(callId, resolve);
      ctx.webContents.send(IPC_CHANNELS.PERMISSION_REQUEST, {
        callId, turnId: ctx.turnId, agentId: ctx.agentId,
        toolName: tool.name, args, description: tool.description,
      });
    }).then((decision) => {
      insertPermission(ctx.db, {
        toolName: tool.name,
        payloadHash: hash(args),
        decision: decision.remember ? "allow_always" : decision.approved ? "allow" : "deny",
      });
      return decision;
    });
  }

  resolve(callId: string, response: PermissionResponse): void {
    const fn = this.pending.get(callId);
    if (fn) { fn({ approved: response.approved, remember: response.remember }); this.pending.delete(callId); }
  }
}
```

Hash function: SHA-256 over canonical JSON of `args`. Reuse `node:crypto`.

DAO it relies on: [packages/memory-core/src/dao/permissions.ts](packages/memory-core/src/dao/permissions.ts) already implements `insertPermission` and `lookupPermission`.

---

## 5. `@bubbles/agent-runtime` — SkillsCompiler + AgentLoop

### 5a. `packages/agent-runtime/src/SkillsCompiler.ts` (~120 lines)

Parses a `skills.md` file. Frontmatter is YAML-ish but in our seed format only uses scalars + comma-list `tools:` — write a tiny hand-roll parser (no `js-yaml` dep needed).

```ts
export interface CompiledAgent {
  id: string;             // from config.json
  name: string;
  model: string;          // e.g. "MiniMax-Text-01"
  voiceId: string;
  tools: string[];        // whitelist for ToolRegistry.forAgent()
  systemPrompt: string;   // composed from sections
  rules: string[];
}

export function compileSkills(skillsMdPath: string, configJsonPath: string): CompiledAgent;
```

Sections to extract from body: `# Personality`, `# Capabilities`, `# Rules`. Compose:
```
You are <name>, <persona line from Personality>.

Capabilities:
<bullet list from Capabilities>

Rules (hard constraints):
- <rule 1>
- <rule 2>
...

Tools available: <comma list>
```

Rules section is also returned as `rules[]` so PermissionGuard could enforce them programmatically later (deferred).

Add `getCompiledAgent(id: string)` to [packages/agent-runtime/src/index.ts](packages/agent-runtime/src/index.ts) — uses the existing `AgentRegistry` path resolution to find each agent's `skills.md`.

### 5b. `packages/agent-runtime/src/AgentLoop.ts` (~220 lines)

```ts
export interface RunOpts {
  agent: CompiledAgent;
  conversationId: string;
  userText: string;
  turnId: string;
  signal: AbortSignal;
  registry: ToolRegistry;
  guard: PermissionGuard;
  reviewCtx: ReviewCtx;
  projectRoot: string;
  history: ChatMessage[]; // prior turns from memory-core
  onDelta(text: string): void;
  onToolCall(name: string, args: unknown): void;
  onToolResult(name: string, result: ToolResult): void;
}

export interface RunResult {
  text: string;
  toolCalls: Array<{ name: string; args: unknown; result: ToolResult }>;
  usage?: ChatUsage;
}

export async function runAgent(opts: RunOpts): Promise<RunResult>;
```

Loop pseudocode:
```
messages = [system(agent.systemPrompt), ...history, user(userText)]
toolDefs = registry.toMiniMaxToolDefs(agent.tools)
toolCallsAccum = []  // per-index { id, name, argsBuf }
text = ""
ctx = { projectRoot, turnId, agentId: agent.id }

while (!signal.aborted) {
  finishReason = null
  for await (chunk of streamChat({ messages, tools: toolDefs, turnId, signal, model: agent.model })) {
    if (chunk.text) { text += chunk.text; onDelta(chunk.text) }
    for (delta of chunk.toolCallDeltas ?? []) accumulate(toolCallsAccum, delta)
    if (chunk.finishReason) { finishReason = chunk.finishReason; break }
  }

  if (finishReason !== "tool_calls" || toolCallsAccum.length === 0) break

  // route every accumulated tool call through guard + registry
  const assistantMsg = { role: "assistant", content: text, tool_calls: toolCallsAccum }
  messages.push(assistantMsg)
  for (call of toolCallsAccum) {
    const tool = registry.get(call.name)
    if (!tool) { feedToolError(messages, call, "unknown tool"); continue }
    const args = JSON.parse(call.argsBuf)
    onToolCall(call.name, args)
    const decision = ctx.planApproved && tool.name !== "plan_mode"
      ? { approved: true, remember: false }
      : await guard.review(tool, args, reviewCtx)
    if (!decision.approved) { feedToolError(messages, call, "user denied"); continue }
    const result = await tool.invoke(args, ctx)
    if (tool.name === "plan_mode" && result.ok) ctx.planApproved = true
    onToolResult(call.name, result)
    messages.push({ role: "tool", tool_call_id: call.id, content: result.content })
  }
  toolCallsAccum = []
  text = ""
}

return { text, toolCalls: [...] , usage: lastUsage }
```

Token-budget summarizer: count input tokens roughly (chars/4); if > 180k, replace oldest 30% with a synthesized summary via a second `streamChat` call (single-pass, no tools). Defer if time-constrained but stub the entrypoint.

Tests: mock `streamChat` to yield a tool_call chunk, assert `guard.review` is called, assert message history shape after a successful tool round-trip.

---

## 6. `apps/desktop/main` — refactor + permission router

### 6a. **Refactor** [apps/desktop/src/main/ipc/agentHandler.ts](apps/desktop/src/main/ipc/agentHandler.ts)

Current handler (173 lines) inlines `streamChat`. Replace the body of the `AGENT_RUN` handler to:
1. Resolve `agent = getCompiledAgent(req.agentId)`. Fall back to a generic Bubbles compiled-agent if not found.
2. Read prior history for `conversationId` via `getMessagesByConversation` (already in memory-core DAO).
3. Build `RunOpts`: pass `registry` (singleton), `guard` (singleton), `projectRoot` (computed once at startup, see 6c), `reviewCtx: { agentId, turnId, webContents: evt.sender, db }`.
4. Call `runAgent(opts)`. `onDelta` → send `AGENT_STREAM` chunk. `onToolCall`/`onToolResult` → send `AGENT_STREAM` with `toolCall`/`toolResult` fields for UI display.
5. After completion: insert assistant message with `tool_calls` JSON if any; record cost; do TTS on `result.text`; emit mood transitions (thinking → talking → idle).

Keep all existing flows for TTS, mood, cost — only swap the chat-streaming core.

### 6b. **New file** `apps/desktop/src/main/ipc/permissionRouter.ts` (~30 lines)

```ts
export function registerPermissionRouter(guard: PermissionGuard): void {
  ipcMain.on(IPC_CHANNELS.PERMISSION_RESPOND, (_evt, raw: unknown) => {
    const parsed = PermissionResponseSchema.safeParse(raw);
    if (!parsed.success) return;
    guard.resolve(parsed.data.callId, parsed.data);
  });
}
```

Call from main `index.ts` startup, right after DB init.

### 6c. **New file** `apps/desktop/src/main/projectRoot.ts` (~25 lines)

```ts
export function getProjectRoot(): string {
  const root = join(app.getPath("userData"), "workspace"); // ~/.bubbles/workspace
  mkdirSync(root, { recursive: true });
  return root;
}
```

POC scope: a single workspace inside Electron `userData`. Phase 5 (Project concept) will expand this.

### 6d. **Wire singletons** in `apps/desktop/src/main/index.ts`:
```ts
const registry = createDefaultRegistry();
const guard = new PermissionGuard();
const projectRoot = getProjectRoot();
registerAgentHandler(db, registry, guard, projectRoot);
registerPermissionRouter(guard);
```

---

## 7. `apps/desktop/preload` — permission surface

**Modify** [apps/desktop/src/preload/index.ts](apps/desktop/src/preload/index.ts) (current: 128 lines). Add under `bubbles`:

```ts
permission: {
  onRequest: (cb: (req: PermissionRequest) => void): UnsubscribeFn => {
    const handler = (_e, req) => cb(req);
    ipcRenderer.on(IPC_CHANNELS.PERMISSION_REQUEST, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PERMISSION_REQUEST, handler);
  },
  respond: (res: PermissionResponse): void => {
    ipcRenderer.send(IPC_CHANNELS.PERMISSION_RESPOND, res);
  },
},
```

Update [apps/renderer/src/vite-env.d.ts](apps/renderer/src/vite-env.d.ts) with matching types.

---

## 8. `apps/renderer` — inline PermissionModal

**Modify** [apps/renderer/src/ChatApp.tsx](apps/renderer/src/ChatApp.tsx) (current: ~306 lines).

Add state:
```ts
const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
const [remember, setRemember] = useState(false);
```

Subscribe in `useEffect`:
```ts
const unsub = window.bubbles?.permission.onRequest(setPendingPermission);
return unsub;
```

Render an overlay when `pendingPermission` is non-null:
```tsx
{pendingPermission && (
  <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md">
      <h3 className="text-lg font-semibold mb-2">
        {pendingPermission.toolName}: approve?
      </h3>
      <p className="text-sm text-zinc-400 mb-3">{pendingPermission.description}</p>
      <pre className="text-xs bg-zinc-950 p-3 rounded max-h-48 overflow-auto">
        {JSON.stringify(pendingPermission.args, null, 2)}
      </pre>
      <label className="flex items-center gap-2 mt-3 text-sm">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember this choice
      </label>
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={() => respond(false)}>Deny</button>
        <button onClick={() => respond(true)} className="bg-blue-600">Approve</button>
      </div>
    </div>
  </div>
)}
```

Tool-call indicator in the message stream: when `AgentStreamChunk` arrives with `toolCall` or `toolResult`, render a small `[tool: writeFile ✓]` chip above the assistant draft so the user sees what the agent is doing.

---

## 9. Update `scripts/seed-presets.ts` — richer skills.md

**Modify** [scripts/seed-presets.ts](scripts/seed-presets.ts) lines 75-78 (currently writes a stub `# Personality\nFriendly and helpful.`). Replace with three role-specific templates:

**`bubbles/skills.md`** — general assistant: tools `readFile, listDir`, friendly tone, asks before doing anything destructive.

**`coda/skills.md`** — coding assistant: tools `readFile, writeFile, listDir, plan_mode`. Rules: "Always draft a plan via plan_mode before writing files when the task touches more than one file." "Never edit outside the project root."

**`sage/skills.md`** — research assistant: tools `readFile` only. Personality: thoughtful, references prior memory.

Make `seed-presets` idempotent for skills.md too (currently it only skips when `config.json` exists — needs to also rewrite skills.md when the template changes; add a `--force` flag or simply overwrite skills.md every run since users haven't edited it yet).

Also create `~/.bubbles/workspace/.gitkeep` so the tools have somewhere to operate.

---

## Critical files modified or created

### Created
- `packages/tool-kit/src/Tool.ts`
- `packages/tool-kit/src/registry.ts`
- `packages/tool-kit/src/readFile.ts`
- `packages/tool-kit/src/writeFile.ts`
- `packages/tool-kit/src/listDir.ts`
- `packages/tool-kit/src/planMode.ts`
- `packages/permission-guard/src/Guard.ts`
- `packages/agent-runtime/src/SkillsCompiler.ts`
- `packages/agent-runtime/src/AgentLoop.ts`
- `apps/desktop/src/main/ipc/permissionRouter.ts`
- `apps/desktop/src/main/projectRoot.ts`
- Co-located `*.test.ts` for each above

### Modified
- `packages/shared-types/src/ipc.ts` — permission schemas + channels
- `packages/shared-types/src/message.ts` — `ToolCallSchema` if missing
- `packages/minimax-client/src/chat.ts` — SSE parser yields `toolCallDeltas`
- `packages/tool-kit/package.json` — add `zod-to-json-schema`
- `packages/agent-runtime/src/index.ts` — re-export `compileSkills`, `runAgent`
- `packages/tool-kit/src/index.ts` — re-export `Tool`, `ToolRegistry`, `createDefaultRegistry`
- `packages/permission-guard/src/index.ts` — re-export `PermissionGuard`
- `apps/desktop/src/main/index.ts` — wire singletons
- `apps/desktop/src/main/ipc/agentHandler.ts` — replace inline streamChat with `runAgent`
- `apps/desktop/src/preload/index.ts` — `permission.onRequest` / `respond`
- `apps/renderer/src/vite-env.d.ts` — permission API types
- `apps/renderer/src/ChatApp.tsx` — inline `PermissionModal` overlay + tool-call chips
- `scripts/seed-presets.ts` — role-specific `skills.md` for 3 presets + workspace dir

### Reused (no changes)
- [packages/memory-core/src/dao/permissions.ts](packages/memory-core/src/dao/permissions.ts) — `insertPermission`, `lookupPermission`
- [packages/memory-core/src/dao/messages.ts](packages/memory-core/src/dao/messages.ts) — `insertMessage`, `getMessagesByConversation` (provides history to AgentLoop)
- [packages/memory-core/src/dao/conversations.ts](packages/memory-core/src/dao/conversations.ts) — already inserts conversation rows on first turn
- [packages/cost-meter/src/index.ts](packages/cost-meter/src/index.ts) — `recordCostEvent` reused in refactored handler
- [packages/agent-runtime/src/AgentRegistry.ts](packages/agent-runtime/src/AgentRegistry.ts) — gives us each agent's directory path; `SkillsCompiler` reads `skills.md` from it
- [packages/minimax-client/src/backoff.ts](packages/minimax-client/src/backoff.ts) — retry logic already covers the tool-enabled `streamChat`

---

## Risks & unknowns

1. **MiniMax tool-call support depends on model.** Current default `"MiniMax-Text-01"` may not support the `tools` array reliably. Validate against the user's API tier early; if the model doesn't return `tool_calls`, the AgentLoop falls through to plain text mode which is acceptable for `"what's 2+2?"` but fails the writeFile exit-gate test. Action: smoke-test `streamChat` with `tools` against the real API before wiring everything up; fall back to `"MiniMax-M1"` or `"abab6.5s-chat"` if needed.

2. **SSE `tool_calls` delta accumulation across chunks.** MiniMax streams the JSON arguments string in pieces. Must accumulate by `index` field — getting this wrong silently corrupts tool args. Cover with a unit test that splits a 3-chunk argument across SSE events.

3. **Permission Promise leaks.** If a turn aborts (`signal`) while `guard.review()` is pending, the resolver remains in `pending`. Add `guard.cancel(turnId)` and call it on abort.

4. **Project-root path escape.** All file tools must call `path.resolve(root, userPath)` then assert `resolved.startsWith(root + path.sep)`. Easy to forget — write a shared helper `scopedPath(root, p)` in tool-kit and use it from all three file tools.

5. **`plan_mode` UX.** The plan is approved once and unlocks subsequent writeFiles in the same turn. If the plan changes mid-turn (model decides to do something different), `planApproved` still allows it. Mitigate by storing the approved-plan content and comparing roughly, OR keep simple-and-permissive for POC and refine later.

6. **`zod-to-json-schema` v3 output shape.** Some flags (`target`, `$refStrategy`) affect the result. Pin to `"openApi3"` target and verify the output matches what MiniMax expects (look at any existing MiniMax tool-call docs or test against the API).

---

## Verification

End-to-end, run `pnpm dev:desktop` after each phase:

**After step 4 (Guard built)** — Unit-test only: `pnpm --filter @bubbles/permission-guard test` should cover the 3-policy cascade.

**After step 5 (AgentLoop wired)** — `pnpm --filter @bubbles/agent-runtime test` covers the tool-routing path with a mocked `streamChat`.

**After step 8 (UI done)** — Manual exit-gate verification:

1. `pnpm seed-presets` — confirm `~/.bubbles/agents/{bubbles,coda,sage}/skills.md` are present and richer than current stub. Confirm `~/.bubbles/workspace/` exists.
2. `pnpm dev:desktop` — app boots, click avatar → chat panel opens, save MiniMax API key.
3. **Test 1** (Bubbles, no tools): type `"what's 2+2?"` → reply streams, no permission prompt. Verify in DB:
   ```sql
   sqlite3 ~/.bubbles/memory.db "SELECT role, content FROM messages ORDER BY created_at DESC LIMIT 4;"
   ```
   Should show user + assistant rows with correct conversation_id linkage.
4. **Test 2** (Coda + plan_mode + writeFile):
   - Switch to Coda agent in the chat panel.
   - Type `"make hello.txt with my name (Madura)"`.
   - Expected sequence: a tool-call chip `[plan_mode]` appears → permission modal pops with `plan_mode` and the steps → click Approve → another chip `[writeFile]` appears → modal pops with `path: hello.txt, content: ...` → click Approve.
   - Verify: `cat ~/.bubbles/workspace/hello.txt` shows the expected content.
   - Verify: `permissions` table has rows for both `plan_mode` and `writeFile`.
5. **Test 3** (Deny path): repeat Test 2 but click Deny on the writeFile prompt. Agent should reply with an "I couldn't complete that — user denied" message. File should NOT exist.
6. **Test 4** (Remember choice): repeat Test 2 with the "Remember this choice" checkbox ticked on approval. Next identical request should skip the modal.
7. **Test 5** (Abort mid-tool): start a long agent turn, click the avatar (or some abort UI) — verify `signal.aborted` propagates and the conversation ends cleanly without orphaned permission prompts.

**Coverage check**: `pnpm test` — all four newly-built packages should have ≥70% coverage (target from `.cursorrules`).

**Phase 4 exit gate satisfied** when Test 1 + Test 2 pass and DB rows match expectations.
