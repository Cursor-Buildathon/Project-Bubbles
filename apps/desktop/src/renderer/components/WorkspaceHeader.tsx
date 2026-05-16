import { PointerEvent } from 'react';
import { Activity, X } from 'lucide-react';
import { type AgentProfile, type ConnectorConfig, type SetupStatus } from '@bubbles/core';

interface WorkspaceHeaderProps {
  activeAgent: AgentProfile | null;
  connectors: ConnectorConfig[];
  onClose: () => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  setupStatus: SetupStatus | null;
}

export function WorkspaceHeader({
  activeAgent,
  connectors,
  onClose,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  setupStatus
}: WorkspaceHeaderProps) {
  const liveCount = connectors.filter((connector) => connector.enabled && connector.mode === 'real').length;
  const fixtureCount = connectors.filter((connector) => connector.enabled && connector.mode === 'fixture').length;

  return (
    <header
      className="workspace-header"
      data-testid="assistant-panel-drag-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="workspace-header__title">
        <p className="eyebrow">{activeAgent?.badgeName ?? 'Bubbles'}</p>
        <h1>Assistant workspace</h1>
      </div>
      <div className="workspace-header__status" aria-label="Workspace summary">
        <span className={setupStatus?.state === 'ready' ? 'status-pill status-pill--ready' : 'status-pill status-pill--warning'}>
          <Activity size={14} aria-hidden="true" />
          {setupStatus?.state === 'ready' ? 'MiniMax ready' : 'MiniMax setup'}
        </span>
        <span className="status-pill">{liveCount} real</span>
        <span className={fixtureCount ? 'status-pill status-pill--fixture' : 'status-pill'}>{fixtureCount} fixture</span>
      </div>
      <button className="icon-button" type="button" aria-label="Close assistant panel" onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
    </header>
  );
}
