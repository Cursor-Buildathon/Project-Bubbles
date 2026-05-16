import { describe, expect, it, vi } from 'vitest';
import { registerConnectorIpc } from './connectorIpc.js';

const handles = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handles.set(channel, handler);
    })
  }
}));

describe('registerConnectorIpc', () => {
  it('updates Tavily connector settings without legacy fixture downgrades', async () => {
    handles.clear();
    const connector = {
      id: 'tavily-research',
      name: 'Tavily Research',
      type: 'tavily_research',
      enabled: false,
      mode: 'real',
      authStatus: 'not_configured',
      healthStatus: 'unknown',
      allowedAgents: ['research-agent'],
      requiredApproval: 'none',
      launchConfig: {},
      updatedAt: '2026-05-14T00:00:00.000Z'
    } as const;
    const connectorRegistry = {
      disconnect: vi.fn(),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue([connector]),
      setHealth: vi.fn(),
      update: vi.fn().mockResolvedValue({ ...connector, enabled: true })
    };
    const onChanged = vi.fn();

    registerConnectorIpc({ connectorRegistry, onChanged });
    await handles.get('connectors:update')?.({}, 'tavily-research', {
      enabled: true,
      mode: 'real'
    });

    expect(connectorRegistry.update).toHaveBeenCalledWith('tavily-research', {
      enabled: true,
      mode: 'real'
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
