import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ConnectorConfig } from '@bubbles/core';
import { ConnectorSettings } from './ConnectorSettings';

describe('ConnectorSettings', () => {
  it('shows Tavily connector status and exposes health/disconnect controls', () => {
    const onDisconnect = vi.fn();
    const onHealthCheck = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ConnectorSettings
        connectors={[
          createConnector({
            enabled: true,
            authStatus: 'ready',
            healthStatus: 'healthy'
          })
        ]}
        onDisconnect={onDisconnect}
        onHealthCheck={onHealthCheck}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText('Tavily Research')).toBeInTheDocument();
    expect(screen.getByText('Tavily live web research is ready.')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('research-agent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Check Tavily Research' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Tavily Research' }));

    expect(onHealthCheck).toHaveBeenCalledWith('tavily-research');
    expect(onDisconnect).toHaveBeenCalledWith('tavily-research');
  });

  it('enables Tavily without exposing old MCP fixture or Google Workspace setup actions', () => {
    const onDisconnect = vi.fn();
    const onHealthCheck = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ConnectorSettings
        connectors={[createConnector()]}
        onDisconnect={onDisconnect}
        onHealthCheck={onHealthCheck}
        onUpdate={onUpdate}
      />
    );

    expect(screen.queryByText(/Gmail|Calendar|fixture/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enable Tavily Research' }));

    expect(onUpdate).toHaveBeenCalledWith('tavily-research', {
      allowedAgents: ['research-agent'],
      enabled: true,
      launchConfig: {
        maxResults: 8,
        remoteUrl: 'https://mcp.tavily.com/mcp/',
        searchDepth: 'advanced'
      },
      mode: 'real',
      requiredApproval: 'none'
    });
  });
});

function createConnector(overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: 'tavily-research',
    name: 'Tavily Research',
    type: 'tavily_research',
    enabled: false,
    mode: 'real',
    authStatus: 'not_configured',
    healthStatus: 'unknown',
    allowedAgents: ['research-agent'],
    requiredApproval: 'none',
    launchConfig: {
      maxResults: 8,
      remoteUrl: 'https://mcp.tavily.com/mcp/',
      searchDepth: 'advanced'
    },
    updatedAt: '2026-05-14T00:00:00.000Z',
    ...overrides
  };
}
