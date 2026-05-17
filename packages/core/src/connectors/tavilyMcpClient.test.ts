import { describe, expect, it, vi } from 'vitest';
import { createTavilyRemoteMcpClient } from './tavilyMcpClient.js';

describe('createTavilyRemoteMcpClient', () => {
  it('calls Tavily Remote MCP tools with bearer auth and parses JSON-RPC results', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        headers: { get: (name: string) => (name.toLowerCase() === 'mcp-session-id' ? 'session-1' : null) },
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        text: async () => ''
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: '{"results":[]}' }] } })
      });
    const client = createTavilyRemoteMcpClient({ fetch });

    await expect(client.call('tvly-secret', 'tavily-search', { query: 'Bubbles' })).resolves.toMatchObject({
      ok: true,
      result: { content: [{ text: '{"results":[]}', type: 'text' }] }
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://mcp.tavily.com/mcp/?tavilyApiKey=tvly-secret',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tvly-secret',
          'MCP-Protocol-Version': '2025-06-18'
        })
      })
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      method: 'initialize'
    });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      method: 'notifications/initialized'
    });
    expect(fetch.mock.calls[2][1].headers).toMatchObject({
      'Mcp-Session-Id': 'session-1'
    });
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({
      method: 'tools/call',
      params: {
        arguments: { query: 'Bubbles' },
        name: 'tavily-search'
      }
    });
  });

  it('parses SSE responses with event: prefix lines', async () => {
    const sseBody = [
      'event: message',
      `data: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } })}`
    ].join('\n');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        headers: { get: () => null },
        ok: true,
        status: 200,
        text: async () => sseBody
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: '{"results":[{"title":"Test"}]}' }] } })}`
      });
    const client = createTavilyRemoteMcpClient({ fetch });

    await expect(client.call('tvly-dev-key', 'tavily-search', { query: 'test' })).resolves.toMatchObject({
      ok: true
    });
  });

  it('returns redacted friendly auth and quota errors', async () => {
    const authClient = createTavilyRemoteMcpClient({
      fetch: vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'bad tvly-secret' })
    });
    await expect(authClient.call('tvly-secret', 'tavily-search', {})).resolves.toEqual({
      ok: false,
      error: 'Tavily authentication failed. Recheck the Tavily API key in Connectors.'
    });

    const quotaClient = createTavilyRemoteMcpClient({
      fetch: vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limit tvly-secret' })
    });
    await expect(quotaClient.call('tvly-secret', 'tavily-search', {})).resolves.toEqual({
      ok: false,
      error: 'Tavily quota or rate limit was reached. Check your Tavily plan and try again later.'
    });
  });
});
