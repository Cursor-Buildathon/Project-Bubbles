import { describe, expect, it } from 'vitest';
import { type ConnectorConfig } from '../shared/types.js';
import { createFlowRouter } from './flowRouter.js';

describe('createFlowRouter', () => {
  it('routes email replies into a pending approval instead of sending immediately', async () => {
    const approvals: unknown[] = [];
    const router = createFlowRouter({
      createApproval: async (approval) => {
        approvals.push(approval);
        return {
          id: 'approval-1',
          status: 'pending',
          risk: 'high',
          createdAt: '2026-05-14T00:00:00.000Z',
          ...approval
        };
      }
    });

    await expect(router.route({ userText: 'Reply that I can join', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: true,
      taskType: 'email.reply',
      avatarState: 'waiting_approval',
      message: 'I drafted the reply. Please approve it before I send anything.'
    });
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({ actionType: 'send_email' });
  });

  it('leaves general CLI-backed tasks for the existing bridge', async () => {
    const router = createFlowRouter();

    await expect(router.route({ userText: 'Help me plan my MVP', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: false,
      taskType: 'general.plan',
      suggestedAgentId: 'general-assistant'
    });
  });

  it('returns graceful blocked states for read flows without configured connectors', async () => {
    const router = createFlowRouter();

    await expect(router.route({ userText: 'Read my last email', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: true,
      taskType: 'email.read',
      avatarState: 'concerned',
      message: 'Email is not connected. Open Connectors and connect Gmail or Outlook.'
    });
    await expect(router.route({ userText: 'Check my calendar tomorrow', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: true,
      taskType: 'calendar.read',
      avatarState: 'concerned',
      message: 'Calendar is not connected. Open Connectors and connect Google or Outlook Calendar.'
    });
  });

  it('routes calendar updates into approval previews', async () => {
    const approvals: unknown[] = [];
    const router = createFlowRouter({
      createApproval: async (approval) => {
        approvals.push(approval);
        return {
          id: 'approval-calendar',
          status: 'pending',
          risk: 'high',
          createdAt: '2026-05-14T00:00:00.000Z',
          ...approval
        };
      }
    });

    await expect(router.route({ userText: 'Move my 3pm meeting to Friday', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: true,
      taskType: 'calendar.update',
      avatarState: 'waiting_approval',
      message: 'I drafted the calendar update. Please approve it before I change anything.'
    });
    expect(approvals[0]).toMatchObject({ actionType: 'calendar_update' });
  });

  it('routes web research through the web search connector and returns citations', async () => {
    const router = createFlowRouter({
      connectors: {
        get: async () => connector({ id: 'web-search', type: 'web_search' }),
        webSearch: {
          search: async () => ({
            ok: true,
            provider: 'fixture',
            results: [{ title: 'Workspace MCP', url: 'https://developers.google.com/workspace', snippet: 'Official docs.' }]
          })
        }
      }
    });

    await expect(router.route({ userText: 'research workspace mcp', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: true,
      taskType: 'research.web',
      avatarState: 'working',
      citations: [{ title: 'Workspace MCP', url: 'https://developers.google.com/workspace', snippet: 'Official docs.' }],
      message: 'I found 1 source: Workspace MCP.'
    });
  });

  it('routes connected email read requests through Gmail fixture parity', async () => {
    const router = createFlowRouter({
      connectors: {
        email: {
          latest: async () => ({
            ok: true,
            message: {
              body: 'Can we meet at 3?',
              from: 'Alex <alex@example.com>',
              id: 'message-1',
              subject: 'Planning tomorrow'
            }
          })
        },
        get: async () => connector({ id: 'email', type: 'email' })
      }
    });

    await expect(router.route({ userText: 'Read my latest email', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: true,
      taskType: 'email.read',
      avatarState: 'working',
      message: 'Latest email from Alex <alex@example.com>: Planning tomorrow. Can we meet at 3?'
    });
  });

  it('drafts connected email replies before asking approval', async () => {
    const approvals: unknown[] = [];
    const router = createFlowRouter({
      connectors: {
        email: {
          createDraft: async () => ({ ok: true, provider: 'fixture', draft: { id: 'draft-1' } })
        },
        get: async () => connector({ id: 'email', type: 'email' })
      },
      createApproval: async (approval) => {
        approvals.push(approval);
        return {
          id: 'approval-email',
          status: 'pending',
          risk: 'high',
          createdAt: '2026-05-14T00:00:00.000Z',
          ...approval
        };
      }
    });

    await expect(router.route({ userText: 'Reply that I can join', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: true,
      taskType: 'email.reply',
      avatarState: 'waiting_approval',
      approvalId: 'approval-email'
    });
    expect(approvals[0]).toMatchObject({
      actionType: 'send_email',
      preview: { connectorId: 'email', draftId: 'draft-1' }
    });
  });

  it('routes image generation through the creative service and returns an artifact', async () => {
    const router = createFlowRouter({
      creative: {
        run: async () => ({
          ok: true,
          text: 'The image is ready.',
          artifact: { id: 'image-1', kind: 'image', path: '/tmp/image.svg' }
        })
      }
    });

    await expect(router.route({ userText: 'Generate an image of a neon desk', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      artifacts: [{ id: 'image-1', kind: 'image', path: '/tmp/image.svg' }],
      avatarState: 'celebrating',
      handled: true,
      message: 'The image is ready. You can download it from the chat window.',
      taskType: 'creative.image'
    });
  });

  it('routes music generation through the creative service and returns an audio artifact', async () => {
    const router = createFlowRouter({
      creative: {
        run: async () => ({
          ok: true,
          text: 'The music is ready.',
          artifact: { id: 'audio-1', kind: 'audio', path: '/tmp/music.mp3' }
        })
      }
    });

    await expect(router.route({ userText: 'Make a short song for launch', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      artifacts: [{ id: 'audio-1', kind: 'audio', path: '/tmp/music.mp3' }],
      avatarState: 'celebrating',
      handled: true,
      message: 'The music is ready. You can listen in the chat window.',
      taskType: 'creative.music'
    });
  });

  it('routes landing-page requests into an approval-gated sandbox workflow', async () => {
    const approvals: unknown[] = [];
    const router = createFlowRouter({
      createApproval: async (approval) => {
        approvals.push(approval);
        return {
          id: 'approval-site',
          status: 'pending',
          risk: 'high',
          createdAt: '2026-05-14T00:00:00.000Z',
          ...approval
        };
      }
    });

    await expect(router.route({ userText: 'Build a landing page for my bakery', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      approvalId: 'approval-site',
      avatarState: 'waiting_approval',
      handled: true,
      message: 'I drafted a sandboxed build workflow. Please approve it before I generate and run the landing page.',
      taskType: 'coding.landing_page'
    });
    expect(approvals[0]).toMatchObject({
      actionType: 'shell_command',
      preview: {
        sandboxed: true,
        workflow: ['generate files', 'node scripts/accessibility-check.mjs', 'vite build', 'serve locally', 'open browser']
      }
    });
  });
});

function connector(overrides: Partial<ConnectorConfig>): ConnectorConfig {
  return {
    id: 'connector',
    name: 'Connector',
    type: 'web_search',
    enabled: true,
    mode: 'fixture',
    authStatus: 'ready',
    healthStatus: 'healthy',
    allowedAgents: ['research-agent'],
    requiredApproval: 'preview_sensitive_actions',
    launchConfig: {},
    updatedAt: '2026-05-15T00:00:00.000Z',
    ...overrides
  };
}
