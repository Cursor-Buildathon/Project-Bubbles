import { CheckCircle2, CircleAlert, CircleDashed, PlugZap } from 'lucide-react';
import { type ConnectorConfig, type MemoryItem, type SetupStatus, type VoiceSessionState } from '@bubbles/core';

interface IntegrationStatusBarProps {
  connectors: ConnectorConfig[];
  memories: MemoryItem[];
  setupStatus: SetupStatus | null;
  voiceState: VoiceSessionState;
}

export function IntegrationStatusBar({ connectors, memories, setupStatus, voiceState }: IntegrationStatusBarProps) {
  const setupReady = setupStatus?.state === 'ready';
  const healthyConnectors = connectors.filter((connector) => connector.enabled && connector.healthStatus === 'healthy').length;
  const fixtureConnectors = connectors.filter((connector) => connector.mode === 'fixture').length;

  return (
    <section className="integration-status-bar" data-testid="integration-status-bar" aria-label="Integration status">
      <StatusBadge
        icon={setupReady ? 'ready' : 'warning'}
        label={setupReady ? 'MiniMax ready' : 'MiniMax needs attention'}
        tone={setupReady ? 'ready' : 'warning'}
      />
      <StatusBadge icon="connector" label={`${healthyConnectors}/${connectors.length} connectors healthy`} tone="neutral" />
      <StatusBadge icon="fixture" label={`${fixtureConnectors} fixture`} tone={fixtureConnectors ? 'fixture' : 'neutral'} />
      <StatusBadge icon="ready" label={`${memories.length} memories`} tone="neutral" />
      <StatusBadge icon={voiceState.enabled ? 'ready' : 'warning'} label={voiceStatusText(voiceState)} tone={voiceState.enabled ? 'ready' : 'neutral'} />
    </section>
  );
}

interface StatusBadgeProps {
  icon: 'connector' | 'fixture' | 'ready' | 'warning';
  label: string;
  tone: 'fixture' | 'neutral' | 'ready' | 'warning';
}

function voiceStatusText(voiceState: VoiceSessionState) {
  if (!voiceState.enabled) {
    return 'Voice off';
  }

  if (voiceState.status === 'listening') {
    return 'Voice listening';
  }

  if (voiceState.status === 'processing') {
    return 'Voice processing';
  }

  if (voiceState.status === 'speaking') {
    return 'Voice speaking';
  }

  if (voiceState.status === 'error') {
    return 'Voice needs attention';
  }

  return 'Voice ready';
}

function StatusBadge({ icon, label, tone }: StatusBadgeProps) {
  const Icon = icon === 'ready' ? CheckCircle2 : icon === 'connector' ? PlugZap : icon === 'fixture' ? CircleDashed : CircleAlert;

  return (
    <span className={`status-pill status-pill--${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
