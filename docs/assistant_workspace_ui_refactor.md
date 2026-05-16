# Assistant Workspace UI Refactor

## Theme

The Phase 9 workspace uses the **Luminous Desktop** theme: a modern macOS-style assistant cockpit with warm white glass, mist panels, teal primary accents, coral attention states, graphite text, and green/amber/red status signals.

The UI should feel product-ready and friendly without becoming decorative. Chat stays primary, approvals stay prominent, and every integration surface clearly says whether it is live, degraded, or fixture-backed.

The integrated mock test verified the workspace as a live QA surface: chat, task drawer, approvals, settings, connectors, memory, and timeline can all stay visible without hiding the safety state the user needs to see.

## Layout

- Header: current agent, MiniMax readiness, real/fixture counts, and close control.
- Integration status bar: MiniMax, connector health, fixture count, memory count, and voice state.
- Left rail: conversations, active agent switching, and agent birth preview.
- Center workspace: approvals, active chat, and streaming task drawer.
- Right rail: readiness guidance, setup/settings, connectors, and memory timeline.

The default view must not expose avatar developer mood controls. They live behind the **Developer controls** disclosure for debugging and demo recovery.

## Component Responsibilities

- `WorkspaceHeader`: draggable window header and high-level workspace readiness.
- `IntegrationStatusBar`: judge-facing proof of live vs fixture/degraded integrations.
- `ConversationRail`: conversation history, agent switcher, and agent birth preview.
- `ChatSurface`: primary user input and Bubbles response stream.
- `WorkspaceStatusRail`: setup, connector, memory, logs export, voice toggle, and degraded-state guidance.
- `AssistantPanel`: state wiring and composition only.

## UX Rules

- Fixture mode must be visibly labeled anywhere it can influence demo behavior.
- Missing MiniMax, CLI, MCP, email, calendar, or voice capability must show actionable guidance instead of broken empty UI.
- Approvals render above chat/task work so sensitive actions cannot be missed.
- Chat remains the visual center of the workspace.
- Status chips use concise labels: `ready`, `needs attention`, `fixture`, `real`, `healthy`, or `unhealthy`.
- Logs export must be labeled as redacted.
- Secret-bearing content must not be echoed into chat, memory, timeline, task drawer, approval previews, or exported logs without redaction.
- Cancellation must visibly recover: `task.cancelled` appears, active controls clear, and the avatar returns to a neutral/idle state.
- The universal Bubbles sprite sheet remains the only avatar art system.

## Acceptance Checklist

- Workspace regions are visually distinct and usable at desktop size.
- Integration status is visible without opening settings.
- Fixture connectors are labeled.
- Missing setup/auth states provide next steps.
- Developer mood controls are hidden by default.
- Chat, task drawer, approvals, settings, connectors, and memory render together without overlap.
- Restarted workspace shows persisted setup readiness, fixture connectors, memory/timeline, and approval history without exposing secrets.
