import { describe, expect, it } from 'vitest';
import { type ConnectorConfig } from '../shared/types.js';
import { createEmailConnector } from './emailConnector.js';

describe('createEmailConnector', () => {
  it('searches and reads Gmail threads from fixture mode', async () => {
    const connector = createEmailConnector();
    const config = emailConfig({
      launchConfig: {
        fixture: {
          threads: [
            {
              id: 'thread-1',
              subject: 'Planning tomorrow',
              participants: ['Alex <alex@example.com>'],
              snippet: 'Can we meet at 3?',
              messages: [
                {
                  id: 'message-1',
                  from: 'Alex <alex@example.com>',
                  subject: 'Planning tomorrow',
                  body: 'Can we meet at 3?'
                }
              ]
            }
          ]
        }
      }
    });

    await expect(connector.searchThreads(config, 'from:alex')).resolves.toEqual({
      ok: true,
      provider: 'fixture',
      threads: [{ id: 'thread-1', subject: 'Planning tomorrow', participants: ['Alex <alex@example.com>'], snippet: 'Can we meet at 3?' }]
    });
    await expect(connector.getThread(config, 'thread-1')).resolves.toMatchObject({
      ok: true,
      provider: 'fixture',
      thread: { id: 'thread-1', messages: [{ body: 'Can we meet at 3?' }] }
    });
  });

  it('creates and sends drafts through verified Gmail MCP tool names', async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const connector = createEmailConnector({
      mcpClient: {
        call: async (_config, method, params) => {
          calls.push({ method, params });
          return method === 'create_draft'
            ? { ok: true, result: { id: 'draft-1' } }
            : { ok: true, result: { sent: true } };
        }
      }
    });

    const config = emailConfig({
      mode: 'real',
      launchConfig: {
        httpUrl: 'https://gmailmcp.googleapis.com/mcp/v1'
      }
    });

    await expect(
      connector.createDraft(config, {
        body: 'I can join.',
        subject: 'Re: Planning tomorrow',
        threadId: 'thread-1',
        to: ['Alex <alex@example.com>']
      })
    ).resolves.toEqual({ ok: true, draft: { id: 'draft-1' }, provider: 'mcp' });
    await expect(connector.sendDraft(config, 'draft-1')).resolves.toEqual({ ok: true, provider: 'mcp' });
    expect(calls).toEqual([
      {
        method: 'create_draft',
        params: {
          body: 'I can join.',
          subject: 'Re: Planning tomorrow',
          threadId: 'thread-1',
          to: ['Alex <alex@example.com>']
        }
      },
      { method: 'send_draft', params: { draftId: 'draft-1' } }
    ]);
  });
});

function emailConfig(overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: 'email',
    name: 'Gmail',
    type: 'email',
    enabled: true,
    mode: 'fixture',
    authStatus: 'ready',
    healthStatus: 'healthy',
    allowedAgents: ['email-calendar-assistant'],
    requiredApproval: 'preview_sensitive_actions',
    launchConfig: {},
    updatedAt: '2026-05-15T00:00:00.000Z',
    ...overrides
  };
}
