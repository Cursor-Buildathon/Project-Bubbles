import { describe, expect, it } from 'vitest';
import { createWebSearchConnector } from './webSearchConnector.js';

describe('createWebSearchConnector', () => {
  it('uses MCP search when a real connector is configured', async () => {
    const connector = createWebSearchConnector({
      mcpClient: {
        call: async () => ({
          ok: true,
          result: {
            results: [{ title: 'MCP Guide', url: 'https://example.com', snippet: 'Connect tools.' }]
          }
        })
      }
    });

    await expect(
      connector.search(
        {
          id: 'web-search',
          name: 'Web Search',
          type: 'web_search',
          enabled: true,
          mode: 'real',
          authStatus: 'ready',
          healthStatus: 'healthy',
          allowedAgents: ['research-agent'],
          requiredApproval: 'preview_sensitive_actions',
          launchConfig: { command: 'mcp-search' },
          updatedAt: '2026-05-14T00:00:00.000Z'
        },
        'MCP tools'
      )
    ).resolves.toMatchObject({
      ok: true,
      results: [{ title: 'MCP Guide', url: 'https://example.com', snippet: 'Connect tools.' }]
    });
  });

  it('returns an actionable blocked state when search is not configured', async () => {
    const connector = createWebSearchConnector();

    await expect(
      connector.search(
        {
          id: 'web-search',
          name: 'Web Search',
          type: 'web_search',
          enabled: false,
          mode: 'real',
          authStatus: 'not_configured',
          healthStatus: 'unknown',
          allowedAgents: [],
          requiredApproval: 'preview_sensitive_actions',
          launchConfig: {},
          updatedAt: '2026-05-14T00:00:00.000Z'
        },
        'MCP tools'
      )
    ).resolves.toEqual({
      ok: false,
      error: 'Web search is not connected. Configure a search MCP provider or MiniMax search fallback.'
    });
  });

  it('passes maxResults through MCP and returns normalized citations', async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const connector = createWebSearchConnector({
      mcpClient: {
        call: async (_config, method, params) => {
          calls.push({ method, params });
          return {
            ok: true,
            result: {
              results: [
                { title: 'Live MCP', url: 'https://example.com/mcp', content: 'Current source text.' },
                { title: 'Docs', url: 'https://example.com/docs', snippet: 'Official docs.' }
              ]
            }
          };
        }
      }
    });

    await expect(
      connector.search(
        {
          id: 'web-search',
          name: 'Web Search',
          type: 'web_search',
          enabled: true,
          mode: 'real',
          authStatus: 'ready',
          healthStatus: 'healthy',
          allowedAgents: ['research-agent'],
          requiredApproval: 'preview_sensitive_actions',
          launchConfig: { command: 'mcp-search' },
          updatedAt: '2026-05-14T00:00:00.000Z'
        },
        'MCP tools',
        { maxResults: 2 }
      )
    ).resolves.toEqual({
      ok: true,
      provider: 'mcp',
      results: [
        { title: 'Live MCP', url: 'https://example.com/mcp', snippet: 'Current source text.' },
        { title: 'Docs', url: 'https://example.com/docs', snippet: 'Official docs.' }
      ]
    });
    expect(calls).toEqual([{ method: 'search', params: { query: 'MCP tools', maxResults: 2 } }]);
  });
});
