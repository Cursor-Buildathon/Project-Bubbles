---
name: bubbles-refactor
description: Use when refactoring Bubbles MVP core services, Electron IPC, renderer screens, connector contracts, MiniMax setup, task orchestration, memory/timeline stores, or shared TypeScript types.
---

# Bubbles Refactor

## Orientation

Bubbles has three main layers:

- `packages/core`: pure-ish service logic, typed contracts, sqlite-backed stores, connector abstractions, MiniMax and CLI adapters.
- `apps/desktop/src/main`: Electron windows, app state hydration, IPC registration, keychain/process wiring, and runtime paths.
- `apps/desktop/src/renderer`: React UI, avatar window, panel workspace, setup/settings screens, task drawer, and timeline/memory presentation.

Keep refactors aligned to those boundaries. Move logic toward `packages/core` when it can be tested without Electron. Keep Electron-specific behavior in `apps/desktop/src/main`. Keep renderer components focused on state display and user interactions.

## Refactor Flow

1. Identify the public contract first: exported core types, preload API shape, IPC channel names, connector config shape, or component props.
2. Find all call sites with `rg`, including tests.
3. Add or update a focused test before changing shared behavior.
4. Make the smallest coherent migration. Avoid mixing visual redesign, service migration, and connector behavior unless the task requires it.
5. Run targeted tests and typechecks, then full checks for cross-package changes.

## High-Risk Areas

- `TaskPacket`, `CliEvent`, `ConnectorConfig`, `AgentProfile`, `MemoryItem`, and `SetupStatus` shape changes affect both packages.
- Preload API changes require `global.d.ts`, renderer call sites, and tests to move together.
- Connector registry changes must preserve fixture mode and approval policy behavior.
- MiniMax setup must keep General API key and Token Plan key separate.
- CLI bridge changes must preserve redacted logs, cancellation, timeout, plain stdout parsing, structured event parsing, and MiniMax JSON response parsing.
- Window management changes should be verified in a real Electron runtime when possible.

## Testing Pattern

- Business logic: colocated `*.test.ts` in `packages/core/src`.
- Renderer behavior: React Testing Library tests in `apps/desktop/src/renderer`.
- Avatar/catalog behavior: `apps/desktop/src/avatar`.
- Boundary contracts: prefer small injectable units over tests that require launching Electron.

## Completion Bar

A refactor is not complete until old tests pass, new/updated tests cover the changed behavior, typecheck passes for affected packages, and any intentional contract changes are reflected in `AGENTS.md` or the relevant project skill.
