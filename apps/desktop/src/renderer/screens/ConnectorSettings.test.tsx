import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ConnectorConfig } from '@bubbles/core';
import { ConnectorSettings } from './ConnectorSettings';

describe('ConnectorSettings', () => {
  it('shows connector status and exposes health/disconnect controls', () => {
    const onDisconnect = vi.fn();
    const onHealthCheck = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ConnectorSettings
        connectors={[
          createConnector({
            id: 'web-search',
            name: 'Web Search',
            type: 'web_search',
            enabled: true,
            authStatus: 'ready',
            healthStatus: 'healthy',
            allowedAgents: ['research-agent']
          }),
          createConnector({
            id: 'email',
            name: 'Email',
            type: 'email',
            enabled: false,
            authStatus: 'not_configured',
            healthStatus: 'unknown',
            lastError: 'Connect Gmail or Outlook first.'
          })
        ]}
        onDisconnect={onDisconnect}
        onHealthCheck={onHealthCheck}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText('Web Search')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('research-agent')).toBeInTheDocument();
    expect(screen.getByText('Connect Gmail or Outlook first.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Check Web Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Web Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable Email fixture mode' }));

    expect(onHealthCheck).toHaveBeenCalledWith('web-search');
    expect(onDisconnect).toHaveBeenCalledWith('web-search');
    expect(onUpdate).toHaveBeenCalledWith('email', {
      allowedAgents: ['email-calendar-assistant'],
      enabled: true,
      mode: 'fixture',
      authStatus: 'ready',
      healthStatus: 'healthy'
    });
  });

  it('offers real Google Workspace setup actions with current scope summaries', () => {
    const onDisconnect = vi.fn();
    const onHealthCheck = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ConnectorSettings
        connectors={[
          createConnector({ id: 'email', name: 'Email', type: 'email' }),
          createConnector({ id: 'calendar', name: 'Calendar', type: 'calendar' })
        ]}
        onDisconnect={onDisconnect}
        onHealthCheck={onHealthCheck}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText('Gmail needs gmail.readonly, gmail.compose, and gmail.send after explicit approval.')).toBeInTheDocument();
    expect(screen.getByText('Calendar uses calendar.events.owned for MVP writes.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Gmail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set up Calendar' }));

    expect(onUpdate).toHaveBeenCalledWith('email', {
      allowedAgents: ['email-calendar-assistant'],
      authStatus: 'needs_auth',
      enabled: true,
      healthStatus: 'unhealthy',
      launchConfig: {
        httpUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
        oauth: {
          provider: 'google-workspace',
          scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/gmail.send'
          ]
        }
      },
      mode: 'real',
      requiredApproval: 'preview_sensitive_actions'
    });
    expect(onUpdate).toHaveBeenCalledWith('calendar', {
      allowedAgents: ['email-calendar-assistant'],
      authStatus: 'needs_auth',
      enabled: true,
      healthStatus: 'unhealthy',
      launchConfig: {
        httpUrl: 'https://calendarmcp.googleapis.com/mcp/v1',
        oauth: {
          provider: 'google-workspace',
          scopes: [
            'https://www.googleapis.com/auth/calendar.events.owned',
            'https://www.googleapis.com/auth/calendar.events.readonly',
            'https://www.googleapis.com/auth/calendar.events.freebusy'
          ]
        }
      },
      mode: 'real',
      requiredApproval: 'preview_sensitive_actions'
    });
  });
});

function createConnector(overrides: Partial<ConnectorConfig>): ConnectorConfig {
  return {
    id: 'connector',
    name: 'Connector',
    type: 'web_search',
    enabled: false,
    mode: 'real',
    authStatus: 'not_configured',
    healthStatus: 'unknown',
    allowedAgents: [],
    requiredApproval: 'preview_sensitive_actions',
    launchConfig: {},
    updatedAt: '2026-05-14T00:00:00.000Z',
    ...overrides
  };
}
