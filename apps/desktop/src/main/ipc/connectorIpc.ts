import { ipcMain } from 'electron';
import { type ConnectorConfig, type ConnectorHealth, type ConnectorRegistry } from '@bubbles/core';

interface RegisterConnectorIpcOptions {
  checkHealth?: (connector: ConnectorConfig) => Promise<ConnectorHealth> | ConnectorHealth;
  connectorRegistry: ConnectorRegistry;
  normalizeUpdate?: (id: string, input: Partial<ConnectorConfig>) => Partial<ConnectorConfig>;
  onChanged?: () => Promise<void> | void;
}

export function registerConnectorIpc({ checkHealth, connectorRegistry, normalizeUpdate, onChanged }: RegisterConnectorIpcOptions) {
  async function changed() {
    await onChanged?.();
    return connectorRegistry.list();
  }

  ipcMain.handle('connectors:list', () => connectorRegistry.list());
  ipcMain.handle('connectors:update', async (_event, id: string, input) => {
    await connectorRegistry.update(id, normalizeUpdate?.(id, input) ?? input);
    return changed();
  });
  ipcMain.handle('connectors:healthCheck', async (_event, id: string) => {
    const connector = await connectorRegistry.get(id);
    const health = connector
      ? await (checkHealth?.(connector) ?? defaultHealth(connector))
      : { healthStatus: 'unhealthy' as const, lastError: 'Connector was not found.' };
    await connectorRegistry.setHealth(id, health);
    return changed();
  });
  ipcMain.handle('connectors:disconnect', async (_event, id: string) => {
    await connectorRegistry.disconnect(id);
    return changed();
  });
}

interface ConnectorUpdateFeatureGateOptions {
  calendarRealEnabled: boolean;
  gmailRealEnabled: boolean;
}

export function createConnectorUpdateFeatureGate({
  calendarRealEnabled,
  gmailRealEnabled
}: ConnectorUpdateFeatureGateOptions) {
  return (id: string, input: Partial<ConnectorConfig>): Partial<ConnectorConfig> => {
    const realModeRequested = input.mode === 'real';
    const disabled =
      realModeRequested && ((id === 'email' && !gmailRealEnabled) || (id === 'calendar' && !calendarRealEnabled));

    if (!disabled) {
      return input;
    }

    return {
      ...input,
      allowedAgents: ['email-calendar-assistant'],
      authStatus: 'ready',
      enabled: true,
      healthStatus: 'healthy',
      launchConfig: {},
      mode: 'fixture',
      requiredApproval: 'preview_sensitive_actions'
    };
  };
}

function defaultHealth(connector: ConnectorConfig): ConnectorHealth {
  const healthStatus = connector.enabled && connector.authStatus === 'ready' ? 'healthy' : 'unhealthy';
  const lastError = healthStatus === 'healthy' ? undefined : 'Connector is not configured yet.';
  return { healthStatus, lastError };
}
