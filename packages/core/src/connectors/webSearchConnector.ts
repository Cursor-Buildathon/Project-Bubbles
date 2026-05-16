import { type ConnectorConfig } from '../shared/types.js';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type WebSearchResponse =
  | { ok: true; results: WebSearchResult[]; provider: 'mcp' | 'fixture' | 'minimax' }
  | { ok: false; error: string };

interface McpClientLike {
  call: (config: { command?: string; args?: string[]; httpUrl?: string }, method: string, params: Record<string, unknown>) => Promise<
    | {
        ok: true;
        result: unknown;
      }
    | {
        ok: false;
        error: string;
      }
  >;
}

interface WebSearchConnectorOptions {
  mcpClient?: McpClientLike;
  minimaxSearch?: (query: string) => Promise<WebSearchResult[]>;
}

export function createWebSearchConnector({ mcpClient, minimaxSearch }: WebSearchConnectorOptions = {}) {
  return {
    async search(config: ConnectorConfig, query: string, options: { maxResults?: number } = {}): Promise<WebSearchResponse> {
      if (config.enabled && config.mode === 'fixture') {
        return {
          ok: true,
          provider: 'fixture',
          results: fixtureResults(config, query)
        };
      }

      if (config.enabled && config.authStatus === 'ready' && config.launchConfig.command && mcpClient) {
        const response = await mcpClient.call(
          { command: config.launchConfig.command, args: config.launchConfig.args, httpUrl: config.launchConfig.httpUrl },
          'search',
          { query, ...(options.maxResults ? { maxResults: options.maxResults } : {}) }
        );

        if (!response.ok) {
          return response;
        }

        return {
          ok: true,
          provider: 'mcp',
          results: normalizeResults(response.result)
        };
      }

      if (minimaxSearch) {
        return {
          ok: true,
          provider: 'minimax',
          results: await minimaxSearch(query)
        };
      }

      return {
        ok: false,
        error: 'Web search is not connected. Configure a search MCP provider or MiniMax search fallback.'
      };
    }
  };
}

function fixtureResults(config: ConnectorConfig, query: string): WebSearchResult[] {
  const configured = config.launchConfig.fixture?.results;

  if (Array.isArray(configured)) {
    return normalizeResults({ results: configured });
  }

  return [
    {
      title: `Fixture research for ${query}`,
      url: 'fixture://web-search',
      snippet: 'Fixture mode is active. Connect a real MCP provider for live web results.'
    }
  ];
}

function normalizeResults(value: unknown): WebSearchResult[] {
  const results = Array.isArray((value as { results?: unknown }).results) ? (value as { results: unknown[] }).results : [];

  return results.map((result) => {
    const item = result as { title?: unknown; url?: unknown; snippet?: unknown; content?: unknown };
    return {
      title: typeof item.title === 'string' ? item.title : 'Untitled result',
      url: typeof item.url === 'string' ? item.url : '',
      snippet: typeof item.snippet === 'string' ? item.snippet : typeof item.content === 'string' ? item.content : ''
    };
  });
}
