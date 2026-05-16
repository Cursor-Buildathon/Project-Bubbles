import { describe, expect, it } from 'vitest';
import { createMcpClient } from './mcpClient.js';

describe('createMcpClient', () => {
  it('sends JSON-RPC shaped calls through the configured command runner', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const client = createMcpClient({
      runCommand: async (command, args) => {
        calls.push({ command, args });
        return {
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } })
        };
      }
    });

    await expect(
      client.call({ command: 'mcp-server', args: ['--token', 'sk-cp-secret'] }, 'search', { query: 'MCP tools' })
    ).resolves.toEqual({ ok: true, result: { ok: true } });
    expect(calls[0]).toEqual({
      command: 'mcp-server',
      args: ['--token', '[REDACTED]', JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'search', params: { query: 'MCP tools' } })]
    });
  });

  it('returns redacted errors for failed MCP calls', async () => {
    const client = createMcpClient({
      runCommand: async () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'failed with sk-cp-secret'
      })
    });

    await expect(client.call({ command: 'mcp-server', args: [] }, 'search', {})).resolves.toEqual({
      ok: false,
      error: 'failed with [REDACTED]'
    });
  });

  it('sends JSON-RPC shaped calls through an HTTP OAuth MCP endpoint', async () => {
    const requests: Array<{ url: string; init: { method?: string; headers?: Record<string, string>; body?: string } }> = [];
    const client = createMcpClient({
      fetch: async (url, init) => {
        requests.push({ url, init });
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { threads: [] } })
        };
      },
      runCommand: async () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'command should not run'
      })
    });

    await expect(
      client.call(
        { httpUrl: 'https://gmailmcp.googleapis.com/mcp/v1', accessToken: 'ya29.secret-token' },
        'search_threads',
        { query: 'from:alex' }
      )
    ).resolves.toEqual({ ok: true, result: { threads: [] } });
    expect(requests).toEqual([
      {
        url: 'https://gmailmcp.googleapis.com/mcp/v1',
        init: {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ya29.secret-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'search_threads', params: { query: 'from:alex' } })
        }
      }
    ]);
  });

  it('returns a needs-auth style error when HTTP OAuth is missing a token', async () => {
    const client = createMcpClient({
      fetch: async () => ({
        ok: true,
        status: 200,
        text: async () => '{}'
      }),
      runCommand: async () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'command should not run'
      })
    });

    await expect(client.call({ httpUrl: 'https://calendarmcp.googleapis.com/mcp/v1' }, 'list_events', {})).resolves.toEqual({
      ok: false,
      error: 'OAuth access token is required for HTTP MCP.'
    });
  });
});
