# Bubbles MVP Mock Test Status

Updated: 2026-05-15

Source contract: `docs/MVP-Mock-Test.md` now keeps the original 14-phase baseline and adds post-mock extension phases 15-18 for the newer feature layer.
Evidence root: `/tmp/bubbles-test/`

## Overall Status

- Baseline result: PASS, 14 of 14 phases completed.
- Final live app check: Phase 14 restart persistence passed.
- Final automated checks after Phase 13: `npm test` passed, `npm run typecheck` passed.
- Commit: `35d0fc0` (`-- Al the MockUp Tests are done`) contains the mock-test fix set and the initial status artifact.
- Current post-mock code snapshot reviewed for this update: `3311e08` (`-- advancement initially done`).
- Post-mock scope: voice controls/IPC, voice approval resolution, native macOS speech playback, Google Workspace connector staging, HTTP OAuth MCP support, Gmail/Calendar fixture parity, creative image/music artifacts, C7 landing-page sandboxing, artifact protocol handling, and observability traces.
- Extended manual status: PENDING. The original 14-phase mock evidence does not prove the post-mock voice, artifact, real connector, or landing-page surfaces. Use `docs/Full-MVP-Test.md` sections 14, 14A, 15, 16, and 18 for the expanded acceptance pass.
- Sensitive values: no raw key-like values are reproduced in this status file.

## Post-Mock Advancement Coverage

### Automated Coverage Added

- Voice contracts and policy:
  - `packages/core/src/voice/voiceTypes.test.ts`
  - `packages/core/src/voice/affectDetector.test.ts`
  - `packages/core/src/voice/approvalVoiceDecision.test.ts`
  - `packages/core/src/voice/spokenResponsePolicy.test.ts`
- Voice approvals and desktop IPC:
  - `packages/core/src/approvals/voiceApprovalResolver.test.ts`
  - `apps/desktop/src/main/ipc/voiceIpc.test.ts`
  - `apps/desktop/src/main/ipc/approvalVoiceIpc.test.ts`
  - `apps/desktop/src/main/ipc/speechPlayback.test.ts`
  - `apps/desktop/src/renderer/voice/useVoiceSession.test.tsx`
  - `apps/desktop/src/renderer/components/VoiceControls.test.tsx`
  - `apps/desktop/src/renderer/components/CaptionBar.test.tsx`
- Connector and routing expansion:
  - `packages/core/src/connectors/googleWorkspaceScopes.test.ts`
  - `packages/core/src/connectors/mcpClient.test.ts`
  - `packages/core/src/connectors/emailConnector.test.ts`
  - `packages/core/src/connectors/calendarConnector.test.ts`
  - `packages/core/src/orchestration/flowRouter.test.ts`
  - `apps/desktop/src/main/ipc/connectorIpc.test.ts`
  - `apps/desktop/src/renderer/screens/ConnectorSettings.test.tsx`
- Creative artifacts, landing pages, and trace logging:
  - `packages/core/src/minimax/creativeService.test.ts`
  - `packages/core/src/minimax/ttsService.test.ts`
  - `packages/core/src/coding/landingPageRunner.test.ts`
  - `packages/core/src/observability/trace.test.ts`
  - `apps/desktop/src/main/ipc/capabilityIpc.test.ts`
  - `apps/desktop/src/renderer/components/ChatSurface.test.tsx`
  - `apps/desktop/src/renderer/App.test.tsx`

### Extended Manual QA Backlog

- Voice IPC/window QA: click mic, submit fixture partial/final transcript through preload/test harness, verify captions, chat submission, avatar mapping, native `say` playback, and barge-in.
- Voice approval QA: approve, deny, cancel, and two unclear attempts against a pending approval; verify fallback to visible approval buttons.
- Live microphone STT: BLOCKED/PENDING until a real STT provider is wired. The current code validates IPC, fixture transcript submission, and speech playback, not microphone capture.
- Gmail/Calendar staging QA: verify Connect Gmail/Set up Calendar scope text, `needs_auth` without OAuth token path, fixture downgrade when real connector flags are disabled, and fixture read/write-after-approval parity.
- Real Google Workspace MCP QA: PENDING until OAuth/token configuration is available and exercised.
- Creative artifact QA: verify image SVG and music WAV fixture artifacts in chat by default; separately verify live `mmx image generate` and `mmx music generate` only when `BUBBLES_MINIMAX_MEDIA_FIXTURE=false`.
- C7 landing-page QA: deny/cancel no-op, approve generates under app user-data artifacts, runs accessibility check and Vite build, serves localhost, opens browser, and records trace events.
- Observability/export QA: inspect `task-logs/observability.ndjson` for correlation ids and redacted field summaries without raw transcripts, audio, keys, OAuth tokens, email bodies, or calendar payloads.

## Phase Checklist

### Phase 1. Launch and Workspace - PASS

- [x] Start the app.
- [x] Confirm only the floating avatar appears first.
- [x] Drag Bubbles to a new desktop position.
- [x] Click Bubbles.
- [x] Confirm the assistant workspace opens as a separate window.
- [x] Confirm Bubbles stays above the workspace.
- [x] Confirm the workspace shows chat, agents, task drawer, approvals area, connectors, memory, and settings.
- Evidence: `/tmp/bubbles-test/phase-01/`

### Phase 2. Setup Gate - PASS

- [x] Record `MiniMax ready` when setup is already ready.
- [x] Confirm chat composer is enabled only after ready state.
- Evidence: `/tmp/bubbles-test/phase-02/`

### Phase 3. Fixture Connector Readiness - PASS

- [x] Enable fixture mode for Web Search.
- [x] Enable fixture mode for Local Files.
- [x] Enable fixture mode for Email.
- [x] Enable fixture mode for Calendar.
- [x] Click health check for each enabled connector.
- [x] Confirm each enabled ready connector becomes healthy.
- [x] Confirm readiness no longer reports those fixture connectors as unconfigured.
- Evidence: `/tmp/bubbles-test/phase-03/`

### Phase 4. Memory Seed - PASS

- [x] Send the explicit short-plans memory prompt.
- [x] Confirm Bubbles replies with the expected memory confirmation.
- [x] Confirm avatar moves to a success or celebrating state.
- [x] Confirm the Memory panel shows the saved preference.
- [x] Confirm Timeline shows `Memory saved`.
- Evidence: `/tmp/bubbles-test/phase-04/`

### Phase 5. Agent Switching - PASS

- [x] Activate the Research agent.
- [x] Confirm the avatar badge changes to `Research`.
- [x] Confirm a timeline event records the agent activation.
- [x] Activate the Code agent, then return to Research.
- [x] Confirm the badge updates each time.
- Evidence: `/tmp/bubbles-test/phase-05/`

### Phase 6. Live CLI Research Task - PASS

- [x] With Research active, send the research prompt.
- [x] Confirm chat adds the user message.
- [x] Confirm Task Drawer shows `task.received`.
- [x] Confirm avatar moves through `thinking` or `working`.
- [x] Wait for task completion.
- [x] Confirm Task Drawer shows a final `task.result`.
- [x] Confirm Bubbles posts a concise research answer in chat.
- [x] Confirm Memory or Timeline records task completion.
- Evidence: `/tmp/bubbles-test/phase-06/`
- Fix applied: memory extraction now fails gracefully when generated JSON is malformed.

### Phase 7. General Planning Task Uses the Same System - PASS

- [x] Activate Bubbles or the General agent.
- [x] Send the planning prompt.
- [x] Confirm the task runs through the same Task Drawer pipeline.
- [x] Confirm the final response is short and action-oriented.
- [x] Check whether the saved preference appears in recent memory context or memory panel evidence.
- Evidence: `/tmp/bubbles-test/phase-07/`

### Phase 8. Agent Birth Approval Safety - PASS

- [x] In Agent Birth, enter the agent birth prompt.
- [x] Click `Preview agent`.
- [x] Confirm preview shows a QA-style agent profile, role, skills path, and `skills.md`.
- [x] Click create.
- [x] Confirm Bubbles shows a pending agent file creation approval.
- [x] Deny the approval.
- [x] Confirm no new QA agent appears in the agent list.
- [x] Repeat the preview and create step.
- [x] Approve the second approval.
- [x] Confirm the new QA agent appears in the agent list and becomes active.
- [x] Confirm Timeline records agent creation.
- Evidence: `/tmp/bubbles-test/phase-08/`
- Fix applied: MiniMax JSON parsing and agent birth draft normalization now tolerate wrapped or incomplete generated output.

### Phase 9. Email Safety Flow - PASS

- [x] Send `Read my last email`.
- [x] Confirm Bubbles returns a friendly blocked connector message if no real email connector is connected.
- [x] Send the email approval prompt.
- [x] Confirm an approval card appears for `Send email`.
- [x] Confirm the preview contains recipient, subject, and body fields.
- [x] Confirm the preview is redacted if any token-like text is present.
- [x] Deny the approval.
- [x] Confirm the approval disappears from pending approvals.
- [x] Confirm Timeline or Memory records the denied approval.
- Evidence: `/tmp/bubbles-test/phase-09/`

### Phase 10. Calendar Safety Flow - PASS

- [x] Send `Check my calendar tomorrow`.
- [x] Confirm Bubbles returns a friendly blocked connector message if no real calendar connector is connected.
- [x] Send the calendar approval prompt.
- [x] Confirm an approval card appears for `Update calendar`.
- [x] Confirm preview includes the requested calendar change.
- [x] Cancel the approval.
- [x] Confirm no calendar update is applied.
- [x] Confirm Timeline or Memory records the cancelled approval.
- Evidence: `/tmp/bubbles-test/phase-10/`

### Phase 11. Creative MiniMax Surface - PASS

- [x] Activate Creative.
- [x] Send the creative prompt.
- [x] Confirm Bubbles routes to the creative surface message.
- [x] Confirm the response explains that voice/media output must be connected in Settings for final artifact generation.
- [x] Confirm `Voice off` remains visible in settings.
- Evidence: `/tmp/bubbles-test/phase-11/`

### Phase 12. Task Cancellation Branch - PASS

- [x] Start a longer CLI prompt.
- [x] While the task is active, click the Task Drawer cancel button.
- [x] Confirm a `task.cancelled` event appears.
- [x] Confirm Bubbles says the task was cancelled.
- [x] Confirm active task controls clear.
- [x] Confirm avatar returns to a neutral state.
- Evidence: `/tmp/bubbles-test/phase-12/phase-12-task-active-before-cancel.png`, `/tmp/bubbles-test/phase-12/phase-12-task-cancelled.png`, `/tmp/bubbles-test/phase-12/phase-12-avatar-neutral.png`
- Fix applied: CLI bridge now handles early cancellation before child-process registration and clears stale active state.

### Phase 13. Redaction Check - PASS

- [x] Send a harmless fake key memory prompt.
- [x] Inspect chat, memory, task drawer, and approval previews.
- [x] Export redacted logs.
- [x] Confirm real keys are never visible.
- [x] Confirm fake key-like strings are redacted in logs and security-sensitive previews/errors.
- Evidence: `/tmp/bubbles-test/phase-13/phase-13-redacted-surfaces.png`
- Fix applied: durable memory, timeline summaries, explicit memory echo, and persisted rows are redacted.

### Phase 14. Restart Persistence - PASS

- [x] Close the app.
- [x] Start the app again.
- [x] Open the workspace.
- [x] Confirm setup still reflects the expected ready or recoverable state.
- [x] Confirm connector fixture settings persisted.
- [x] Confirm saved memory and timeline entries are still visible.
- [x] Confirm resolved approval history remains visible in memory/timeline evidence.
- [x] Confirm the latest active/default agent state is reasonable.
- Evidence: `/tmp/bubbles-test/phase-14/phase-14-restarted-workspace-persistence.png`
- Notes: MiniMax ready, four fixture connectors persisted, redacted memory/timeline data persisted, approval history remained available, and no raw fake key appeared in data or exported logs.

## Fix Log

1. Phase 6: malformed memory-extraction JSON no longer breaks task completion.
   - `packages/core/src/memory/memoryExtractor.ts`
   - `packages/core/src/memory/memoryExtractor.test.ts`

2. Phase 8: generated agent-birth JSON can be extracted from wrapped MiniMax responses and normalized before preview/approval.
   - `packages/core/src/minimax/minimaxApiClient.ts`
   - `packages/core/src/minimax/minimaxApiClient.test.ts`
   - `packages/core/src/agents/agentBirthService.ts`
   - `packages/core/src/agents/agentBirthService.test.ts`
   - Approved QA agent artifact: `agents/qa-agent-001/`

3. Phase 12: cancelling immediately after task start now emits `task.cancelled` and clears task/avatar state reliably.
   - `packages/core/src/cli/cliBridge.ts`
   - `packages/core/src/cli/cliBridge.test.ts`
   - `apps/desktop/src/main/main.ts`

4. Phase 13: token-like strings are redacted before durable memory/timeline persistence and in explicit memory chat/timeline echoes.
   - `packages/core/src/memory/memoryStore.ts`
   - `packages/core/src/memory/memoryStore.test.ts`
   - `packages/core/src/timeline/timelineStore.ts`
   - `packages/core/src/timeline/timelineStore.test.ts`
   - `apps/desktop/src/main/main.ts`

## Committed Mock-Test Changes

- `apps/desktop/src/main/main.ts` - QA cancellation delay hook and explicit memory redaction behavior.
- `apps/desktop/tsconfig.node.tsbuildinfo` - generated TypeScript build metadata.
- `packages/core/src/cli/cliBridge.ts` - early/unknown cancellation handling.
- `packages/core/src/cli/cliBridge.test.ts` - cancellation regression tests.
- `packages/core/src/memory/memoryStore.ts` - memory redaction and persisted-row sanitization.
- `packages/core/src/memory/memoryStore.test.ts` - durable memory redaction regression tests.
- `packages/core/src/timeline/timelineStore.ts` - timeline redaction and persisted-row sanitization.
- `packages/core/src/timeline/timelineStore.test.ts` - timeline redaction regression tests.
- `docs/MVP-Mock-Test-Status.md` - phase checklist, evidence references, fix log, and verification snapshot.

## Verification Snapshot

- Phase 12 targeted checks: `npm run test:core -- cliBridge`, `npm run typecheck:core`, `npm run typecheck:desktop`, `npm run test:desktop`.
- Phase 13 targeted checks: `npm run test:core -- memoryStore timelineStore redactSecrets`, `npm run typecheck:core`, `npm run typecheck:desktop`.
- Final checks: `npm test` passed, `npm run typecheck` passed.
- Phase 14 live restart check: passed with evidence in `/tmp/bubbles-test/phase-14/`.
- Post-mock document update checks on 2026-05-15: `npm test` passed with 36 core test files/141 tests and 19 desktop test files/79 tests; `npm run typecheck` passed for core, desktop main, and desktop web configs.
