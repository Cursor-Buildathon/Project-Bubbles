import { Settings } from 'lucide-react';
import {
  type ConnectorConfig,
  type MemoryItem,
  type SetupStatus,
  type TimelineEvent,
  type VoiceSessionState
} from '@bubbles/core';
import { ConnectorSettings } from '../screens/ConnectorSettings';
import { MemoryTimeline } from '../screens/MemoryTimeline';
import { SetupScreen } from '../screens/SetupScreen';

interface WorkspaceStatusRailProps {
  connectors: ConnectorConfig[];
  memories: MemoryItem[];
  onClearMemory: () => void;
  onConnectorDisconnect: (id: string) => void;
  onConnectorHealthCheck: (id: string) => void;
  onConnectorUpdate: (id: string, input: Partial<ConnectorConfig>) => void;
  onSetupStatusChange: (status: SetupStatus) => void;
  setupStatus: SetupStatus | null;
  timelineEvents: TimelineEvent[];
  voiceState: VoiceSessionState;
}

export function WorkspaceStatusRail({
  connectors,
  memories,
  onClearMemory,
  onConnectorDisconnect,
  onConnectorHealthCheck,
  onConnectorUpdate,
  onSetupStatusChange,
  setupStatus,
  timelineEvents,
  voiceState
}: WorkspaceStatusRailProps) {
  async function handleExportLogs() {
    await window.bubbles?.logs?.exportRedacted();
  }

  return (
    <aside className="workspace-status-rail" data-testid="workspace-status-rail" aria-label="Workspace status and settings">
      <section className="workspace-card status-summary-card" aria-label="Graceful fallback status">
        <h2>
          <Settings size={16} aria-hidden="true" />
          Readiness
        </h2>
        <DegradedStateList connectors={connectors} setupStatus={setupStatus} />
      </section>

      <section className="workspace-card" data-testid="settings-panel" aria-label="Settings">
        <SetupScreen status={setupStatus} onStatusChange={onSetupStatusChange} />
        <div className="settings-actions" aria-label="Workspace utility actions">
          <button className="secondary-button" type="button">
            {voiceState.enabled ? 'Voice ready' : 'Voice off'}
          </button>
          <button className="secondary-button" type="button" onClick={() => void handleExportLogs()}>
            Export redacted logs
          </button>
        </div>
      </section>

      <section className="workspace-card" data-testid="connector-panel" aria-label="Connectors">
        <ConnectorSettings
          connectors={connectors}
          onDisconnect={onConnectorDisconnect}
          onHealthCheck={onConnectorHealthCheck}
          onUpdate={onConnectorUpdate}
        />
      </section>

      <section className="workspace-card" data-testid="memory-panel" aria-label="Memory">
        <MemoryTimeline memories={memories} onClearMemory={onClearMemory} timelineEvents={timelineEvents} />
      </section>
    </aside>
  );
}

function DegradedStateList({ connectors, setupStatus }: { connectors: ConnectorConfig[]; setupStatus: SetupStatus | null }) {
  const setupMessage =
    setupStatus?.state === 'ready'
      ? 'MiniMax API and CLI are ready for the live demo.'
      : 'MiniMax is not fully verified. Open setup, recheck CLI, or use fixture-backed demo steps.';
  const connectorMessages = connectors
    .filter((connector) => connector.authStatus !== 'ready' || connector.healthStatus === 'unhealthy')
    .map((connector) => connectorFallbackText(connector));

  return (
    <div className="degraded-state-list">
      <p>{setupMessage}</p>
      {connectorMessages.length ? connectorMessages.map((message) => <p key={message}>{message}</p>) : <p>Connectors with issues will appear here.</p>}
    </div>
  );
}

function connectorFallbackText(connector: ConnectorConfig) {
  const prefix = connector.lastError ? `${connector.lastError}. ` : '';

  if (connector.type === 'calendar') {
    return `${prefix}Use fixture mode for the demo or connect Google/Outlook Calendar.`;
  }

  if (connector.type === 'email') {
    return `${prefix}Use fixture mode for the demo or connect Gmail/Outlook before sending email.`;
  }

  if (connector.type === 'local_files') {
    return `${prefix}Choose approved folders before Bubbles reads local files.`;
  }

  return `${prefix}Configure an MCP provider or use fixture research results for the demo.`;
}
