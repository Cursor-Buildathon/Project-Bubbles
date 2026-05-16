import { type ConnectorConfig } from '../shared/types.js';
import { redactSecrets } from '../security/redactSecrets.js';

export interface TavilySearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export type TavilyResearchResponse =
  | { ok: true; extractedContent: string[]; provider: 'tavily-mcp'; results: TavilySearchResult[] }
  | { ok: false; error: string };

export interface TavilyMcpClientLike {
  call: (apiKey: string, toolName: 'tavily-search' | 'tavily-extract', params: Record<string, unknown>) => Promise<
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

interface TavilyResearchConnectorOptions {
  mcpClient: TavilyMcpClientLike;
}

export function createTavilyResearchConnector({ mcpClient }: TavilyResearchConnectorOptions) {
  return {
    async search(
      config: ConnectorConfig,
      query: string,
      options: { apiKey?: string; maxResults?: number } = {}
    ): Promise<TavilyResearchResponse> {
      if (!config.enabled || config.authStatus !== 'ready') {
        return { ok: false, error: 'Tavily Research is not connected. Add a Tavily API key in Connectors.' };
      }

      if (!options.apiKey) {
        return { ok: false, error: 'Tavily API key is missing. Add a Tavily API key in Connectors.' };
      }

      const maxResults = options.maxResults ?? config.launchConfig.maxResults ?? 8;
      const search = await mcpClient.call(options.apiKey, 'tavily-search', {
        include_images: false,
        include_raw_content: false,
        max_results: maxResults,
        query,
        search_depth: config.launchConfig.searchDepth ?? 'advanced'
      });

      if (!search.ok) {
        return { ok: false, error: redactSecrets(search.error) };
      }

      const results = normalizeTavilyResults(search.result).slice(0, maxResults);
      const urls = results.map((result) => result.url).filter((url) => /^https?:\/\//i.test(url)).slice(0, 5);
      const extractedContent: string[] = [];

      if (urls.length) {
        const extracted = await mcpClient.call(options.apiKey, 'tavily-extract', { urls });

        if (extracted.ok) {
          extractedContent.push(...normalizeExtractedContent(extracted.result));
        }
      }

      return {
        ok: true,
        extractedContent,
        provider: 'tavily-mcp',
        results
      };
    }
  };
}

export function normalizeTavilyResults(value: unknown): TavilySearchResult[] {
  const parsed = parseMcpResult(value);
  const candidates = Array.isArray((parsed as { results?: unknown }).results)
    ? (parsed as { results: unknown[] }).results
    : Array.isArray(parsed)
      ? parsed
      : [];

  return candidates.map((candidate) => {
    const item = candidate as { content?: unknown; raw_content?: unknown; snippet?: unknown; title?: unknown; url?: unknown };
    const snippet =
      typeof item.snippet === 'string'
        ? item.snippet
        : typeof item.content === 'string'
          ? item.content
          : typeof item.raw_content === 'string'
            ? item.raw_content
            : '';

    return {
      content: typeof item.raw_content === 'string' ? item.raw_content : typeof item.content === 'string' ? item.content : undefined,
      snippet,
      title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Untitled source',
      url: typeof item.url === 'string' ? item.url : ''
    };
  });
}

export function normalizeExtractedContent(value: unknown): string[] {
  const parsed = parseMcpResult(value);
  const candidates = Array.isArray((parsed as { results?: unknown }).results)
    ? (parsed as { results: unknown[] }).results
    : Array.isArray(parsed)
      ? parsed
      : [];

  return candidates
    .map((candidate) => {
      const item = candidate as { content?: unknown; raw_content?: unknown };
      return typeof item.raw_content === 'string' ? item.raw_content : typeof item.content === 'string' ? item.content : '';
    })
    .filter((content) => content.trim().length > 0);
}

function parseMcpResult(value: unknown): unknown {
  if (value && typeof value === 'object' && Array.isArray((value as { content?: unknown }).content)) {
    const text = (value as { content: Array<{ text?: unknown; type?: unknown }> }).content
      .map((item) => (typeof item.text === 'string' ? item.text : ''))
      .join('\n')
      .trim();

    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return { results: [{ content: text }] };
      }
    }
  }

  return value;
}
