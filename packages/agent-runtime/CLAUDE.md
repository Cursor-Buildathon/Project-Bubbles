# @bubbles/agent-runtime

## Purpose

Agent lifecycle: **registry** (filesystem presets), **SkillsCompiler** (`skills.md` → runtime agent), **AgentLoop** (ReAct + streaming + abort).

## Public exports

- `AgentRegistry` — scan `~/.bubbles/agents` / bundled presets.
- `SkillsCompiler` — parse frontmatter + markdown sections into prompts + config.
- `AgentLoop` — orchestrate model stream, tools, memory recall, TTS hooks.

## Invariants

- `AbortController` must be respected on every turn (Foundation Enabler #9).
- Presets load from disk, not hardcoded IDs only (Foundation Enabler #3).

## Forbidden

- No direct MiniMax HTTP — use `@bubbles/minimax-client`.
- No direct SQLite — use `@bubbles/memory-core` DAO.

## Run tests

`pnpm --filter @bubbles/agent-runtime test`
