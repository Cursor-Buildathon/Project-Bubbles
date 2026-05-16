import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createConnectorRegistry } from './connectorRegistry.js';

describe('createConnectorRegistry', () => {
  it('creates default connectors and persists health/config updates', async () => {
    const databasePath = join(tmpdir(), `bubbles-connectors-${Date.now()}.sqlite`);
    const registry = await createConnectorRegistry({ databasePath, now: () => '2026-05-14T05:00:00.000Z' });

    await expect(registry.list()).resolves.toMatchObject([
      { id: 'web-search', type: 'web_search', authStatus: 'not_configured', healthStatus: 'unknown' },
      { id: 'local-files', type: 'local_files', authStatus: 'not_configured', healthStatus: 'unknown' },
      { id: 'email', type: 'email', authStatus: 'not_configured', healthStatus: 'unknown' },
      { id: 'calendar', type: 'calendar', authStatus: 'not_configured', healthStatus: 'unknown' }
    ]);

    await registry.update('web-search', {
      enabled: true,
      mode: 'real',
      authStatus: 'ready',
      allowedAgents: ['research-agent'],
      launchConfig: { command: 'mcp-search', args: ['--api-key', 'sk-cp-secret'] }
    });
    await registry.setHealth('web-search', { healthStatus: 'healthy' });

    const reloaded = await createConnectorRegistry({ databasePath });

    await expect(reloaded.get('web-search')).resolves.toMatchObject({
      enabled: true,
      mode: 'real',
      authStatus: 'ready',
      healthStatus: 'healthy',
      allowedAgents: ['research-agent'],
      launchConfig: { command: 'mcp-search', args: ['--api-key', '[REDACTED]'] }
    });
  });
});
