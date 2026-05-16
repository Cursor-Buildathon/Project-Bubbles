import { describe, expect, it, vi } from 'vitest';
import { createConnectorUpdateFeatureGate } from './connectorIpc.js';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

describe('createConnectorUpdateFeatureGate', () => {
  it('downgrades Gmail real-mode setup to fixture mode when the real connector flag is off', () => {
    const normalize = createConnectorUpdateFeatureGate({
      calendarRealEnabled: true,
      gmailRealEnabled: false
    });

    expect(
      normalize('email', {
        authStatus: 'needs_auth',
        healthStatus: 'unhealthy',
        launchConfig: {
          httpUrl: 'https://gmailmcp.googleapis.com/mcp/v1'
        },
        mode: 'real'
      })
    ).toMatchObject({
      authStatus: 'ready',
      healthStatus: 'healthy',
      launchConfig: {},
      mode: 'fixture'
    });
  });

  it('keeps Calendar real-mode setup intact when the real connector flag is on', () => {
    const normalize = createConnectorUpdateFeatureGate({
      calendarRealEnabled: true,
      gmailRealEnabled: false
    });

    expect(
      normalize('calendar', {
        authStatus: 'needs_auth',
        healthStatus: 'unhealthy',
        mode: 'real'
      })
    ).toMatchObject({
      authStatus: 'needs_auth',
      healthStatus: 'unhealthy',
      mode: 'real'
    });
  });
});
