import { describe, expect, it, vi } from 'vitest';
import { createTavilyResearchConnector, normalizeExtractedContent, normalizeTavilyResults } from './tavilyResearchConnector.js';
import { type ConnectorConfig } from '../shared/types.js';

describe('createTavilyResearchConnector', () => {
  it('runs Tavily search and extraction through MCP tools', async () => {
    const mcpClient = {
      call: vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  results: [{ title: 'Source', url: 'https://example.com', content: 'Snippet' }]
                })
              }
            ]
          }
        })
        .mockResolvedValueOnce({
          ok: true,
          result: { results: [{ raw_content: 'Full page content' }] }
        })
    };

    const connector = createTavilyResearchConnector({ mcpClient });
    await expect(connector.search(tavilyConfig(), 'search me Bubbles', { apiKey: 'tvly-key' })).resolves.toEqual({
      ok: true,
      extractedContent: ['Full page content'],
      provider: 'tavily-mcp',
      results: [{ content: 'Snippet', snippet: 'Snippet', title: 'Source', url: 'https://example.com' }]
    });
    expect(mcpClient.call).toHaveBeenNthCalledWith(1, 'tvly-key', 'tavily-search', {
      include_images: false,
      include_raw_content: false,
      max_results: 8,
      query: 'search me Bubbles',
      search_depth: 'advanced'
    });
    expect(mcpClient.call).toHaveBeenNthCalledWith(2, 'tvly-key', 'tavily-extract', {
      urls: ['https://example.com']
    });
  });

  it('blocks disabled or missing-key Tavily runs with setup guidance', async () => {
    const connector = createTavilyResearchConnector({ mcpClient: { call: vi.fn() } });

    await expect(connector.search({ ...tavilyConfig(), enabled: false }, 'query', { apiKey: 'tvly-key' })).resolves.toEqual({
      ok: false,
      error: 'Tavily Research is not connected. Add a Tavily API key in Connectors.'
    });
    await expect(connector.search(tavilyConfig(), 'query')).resolves.toEqual({
      ok: false,
      error: 'Tavily API key is missing. Add a Tavily API key in Connectors.'
    });
  });
});

describe('Tavily MCP result normalization', () => {
  it('normalizes content array JSON and extracted raw content', () => {
    expect(
      normalizeTavilyResults({
        content: [{ type: 'text', text: '{"results":[{"title":"A","url":"https://a.test","snippet":"S"}]}' }]
      })
    ).toEqual([{ content: undefined, snippet: 'S', title: 'A', url: 'https://a.test' }]);
    expect(normalizeExtractedContent({ results: [{ raw_content: 'Page A' }, { content: 'Page B' }] })).toEqual(['Page A', 'Page B']);
  });
});

function tavilyConfig(): ConnectorConfig {
  return {
    id: 'tavily-research',
    name: 'Tavily Research',
    type: 'tavily_research',
    enabled: true,
    mode: 'real',
    authStatus: 'ready',
    healthStatus: 'healthy',
    allowedAgents: ['general-assistant'],
    requiredApproval: 'none',
    launchConfig: { maxResults: 8, remoteUrl: 'https://mcp.tavily.com/mcp/', searchDepth: 'advanced' },
    updatedAt: '2026-05-14T00:00:00.000Z'
  };
}
