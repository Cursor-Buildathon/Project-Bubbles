# Bubbles Buildathon Demo Script

## Goal

Show Bubbles as a desktop pet assistant that can route real work through MiniMax, CLI tasks, agents, approvals, connectors, memory, and a single expressive avatar.

The integrated mock test has passed the full 14-phase MVP flow. Use `docs/MVP-Mock-Test-Status.md` as the latest evidence reference before a live demo.

## Script

1. Launch Bubbles and show only the floating avatar.
2. Drag Bubbles to a comfortable desktop position.
3. Click Bubbles to open the assistant workspace.
4. Open setup and verify the MiniMax General API key, Token Plan Key, and CLI readiness.
5. Say or type: `Hey Bubbles, help me plan my Bubbles MVP.`
6. Show the task drawer streaming the CLI-backed plan result.
7. Say or type: `Research the best way to connect MCP tools.`
8. Show the research result and connector status.
9. Say or type: `Create a coding agent for this project.`
10. Preview the generated agent profile and `skills.md`, then create it after approval.
11. Say or type: `Read my last email.`
12. Use the real email connector when configured; otherwise show fixture mode clearly.
13. Say or type: `Reply that I can join.`
14. Show the approval card before sending.
15. Say or type: `Check my calendar for tomorrow.`
16. Use the real calendar connector when configured; otherwise show fixture mode clearly.
17. Say or type: `Remember I like short plans.`
18. Ask another planning question and show Bubbles using the saved preference.
19. Start a longer research task, cancel it from the Task Drawer, and show `task.cancelled`, the cancellation chat response, cleared controls, and neutral avatar recovery.
20. Show `Export redacted logs` and explain that token-like strings are redacted before logs, durable memory, timeline entries, and approval previews.
21. Restart the app if time allows, then show setup readiness, fixture connector settings, memory, timeline, and approval history persisted.

## Demo Notes

- Keep the workspace open so judges can see chat, task events, approvals, memory, and connector health.
- Call out the real/fixture status chips before email and calendar.
- If MiniMax or CLI is unavailable, use the degraded guidance in the readiness rail and explain the missing setup.
- Do not expose raw keys, logs with secrets, or unredacted connector payloads.
- Email and calendar writes remain approval-preview only during demos. Do not send, save, or confirm real third-party actions unless the demo plan explicitly changes and the user approves.
- Agent Birth is safe to demonstrate because generated files are gated by approval; deny once to show safety, then approve only a demo-safe agent.
