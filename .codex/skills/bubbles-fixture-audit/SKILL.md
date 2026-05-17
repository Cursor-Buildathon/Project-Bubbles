---
name: bubbles-fixture-audit
description: Use when finding, removing, replacing, or reviewing Bubbles MVP fixture-only workflows, static demo UI, placeholder agent/tool surfaces, declared-but-unimplemented task events, media fixture paths, or stale references to removed connector/CLI systems.
---

# Bubbles Fixture Audit

## Audit Flow

1. Run `npm run audit:fixtures`.
   - Add `-- --include-tests` when test fixture coverage matters.
   - Add `-- --include-docs --include-skills` when cleaning stale guidance.
2. Separate each finding into one of:
   - test-only mock
   - explicit test/CI fallback
   - renderer/dev fallback
   - user-reachable static workflow
   - declared contract without an executor
   - stale documentation or skill guidance
3. Trace user-reachable findings from renderer action to preload, IPC, core service, and tests.
4. Replace fixture behavior only when the task asks for implementation. Otherwise report the inventory with file evidence.

## Current Known Categories

- MiniMax media fixture fallback through `BUBBLES_MINIMAX_MEDIA_FIXTURE`.
- Voice transcript fixture injection exposed through IPC for tests/dev.
- Landing-page generation uses a deterministic local template.
- Conversation history is static UI.
- Avatar drag/drop only changes visual state.
- Some agent `allowedTools` are descriptive labels rather than executable tools.

## Guardrails

- Preserve explicit MiniMax media fixture behavior only for tests/CI unless the user asks to remove it.
- Treat any fixture used in a live feature or demo path as product debt to remove.
- Do not reintroduce generic MCP fixture connectors, Google Workspace, Gmail, Calendar, Local Files, Web Search fixture, or MiniMax CLI flows.
- Keep findings grounded in production files, not only tests.

## Extra Reference

Read `references/current-fixtures.md` when you need the current baseline before changing fixture-like behavior.
