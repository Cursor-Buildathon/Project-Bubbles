import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createConnectorRegistry } from './connectorRegistry.js';

describe('createConnectorRegistry', () => {
  it('creates the Tavily connector and persists health/config updates', async () => {
    const databasePath = join(tmpdir(), `bubbles-connectors-${Date.now()}.sqlite`);
    const registry = await createConnectorRegistry({ databasePath, now: () => '2026-05-14T05:00:00.000Z' });

    await expect(registry.list()).resolves.toMatchObject([
      {
        authStatus: 'not_configured',
        healthStatus: 'unknown',
        id: 'tavily-research',
        mode: 'real',
        type: 'tavily_research'
      }
    ]);

    await registry.update('tavily-research', {
      enabled: true,
      authStatus: 'ready',
      launchConfig: {
        maxResults: 5,
        remoteUrl: 'https://mcp.tavily.com/mcp/',
        searchDepth: 'advanced'
      }
    });
    await registry.setHealth('tavily-research', { healthStatus: 'healthy' });

    const reloaded = await createConnectorRegistry({ databasePath });

    await expect(reloaded.get('tavily-research')).resolves.toMatchObject({
      authStatus: 'ready',
      enabled: true,
      healthStatus: 'healthy',
      launchConfig: {
        maxResults: 5,
        remoteUrl: 'https://mcp.tavily.com/mcp/',
        searchDepth: 'advanced'
      }
    });
  });
});
