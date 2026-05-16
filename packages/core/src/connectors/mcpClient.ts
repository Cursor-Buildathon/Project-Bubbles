import { type CommandRunner } from '../shared/commandRunner.js';
import { redactSecrets } from '../security/redactSecrets.js';

export interface McpLaunchConfig {
  command?: string;
  args?: string[];
  httpUrl?: string;
  accessToken?: string;
}

export type McpCallResult =
  | {
      ok: true;
      result: unknown;
    }
  | {
      ok: false;
      error: string;
    };

interface McpClientOptions {
  fetch?: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
    ok: boolean;
    status: number;
    text: () => Promise<string>;
  }>;
  runCommand: CommandRunner;
}

export function createMcpClient({ fetch, runCommand }: McpClientOptions) {
  return {
    async call(config: McpLaunchConfig, method: string, params: Record<string, unknown>): Promise<McpCallResult> {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      } as const;

      if (config.httpUrl) {
        return callHttpMcp(config, request, fetch);
      }

      if (!config.command) {
        return {
          ok: false,
          error: 'MCP command is not configured.'
        };
      }

      const args = [...(config.args ?? []).map((arg) => redactSecrets(arg)), JSON.stringify(request)];
      const result = await runCommand(config.command, args);

      if (result.exitCode !== 0) {
        return {
          ok: false,
          error: redactSecrets(result.stderr || result.stdout || `MCP command exited with ${result.exitCode}.`)
        };
      }

      try {
        const parsed = JSON.parse(result.stdout) as { error?: unknown; result?: unknown };

        if (parsed.error) {
          return {
            ok: false,
            error: redactSecrets(parsed.error)
          };
        }

        return {
          ok: true,
          result: parsed.result
        };
      } catch (error) {
        return {
          ok: false,
          error: redactSecrets(error)
        };
      }
    }
  };
}

async function callHttpMcp(
  config: McpLaunchConfig,
  request: { jsonrpc: '2.0'; id: number; method: string; params: Record<string, unknown> },
  fetchMcp?: McpClientOptions['fetch']
): Promise<McpCallResult> {
  if (!fetchMcp) {
    return {
      ok: false,
      error: 'HTTP MCP transport is unavailable.'
    };
  }

  if (!config.accessToken) {
    return {
      ok: false,
      error: 'OAuth access token is required for HTTP MCP.'
    };
  }

  try {
    const response = await fetchMcp(config.httpUrl ?? '', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    const body = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        error: redactSecrets(body || `HTTP MCP request failed with ${response.status}.`)
      };
    }

    const parsed = JSON.parse(body) as { error?: unknown; result?: unknown };

    if (parsed.error) {
      return {
        ok: false,
        error: redactSecrets(parsed.error)
      };
    }

    return {
      ok: true,
      result: parsed.result
    };
  } catch (error) {
    return {
      ok: false,
      error: redactSecrets(error)
    };
  }
}
