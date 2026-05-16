import { PlugZap, RefreshCw, Unplug } from 'lucide-react';
import { type ConnectorConfig } from '@bubbles/core';
import { RENDERER_CALENDAR_SETUP, RENDERER_GMAIL_SETUP } from '../connectors/googleWorkspaceSetup';

interface ConnectorSettingsProps {
  connectors: ConnectorConfig[];
  onDisconnect: (id: string) => void;
  onHealthCheck: (id: string) => void;
  onUpdate: (id: string, input: Partial<ConnectorConfig>) => void;
}

export function ConnectorSettings({ connectors, onDisconnect, onHealthCheck, onUpdate }: ConnectorSettingsProps) {
  return (
    <div className="connector-settings">
      <h2>
        <PlugZap size={16} aria-hidden="true" />
        Connectors
      </h2>
      <div className="connector-list">
        {connectors.map((connector) => (
          <article className="connector-row" key={connector.id}>
            <div className="connector-row__main">
              <h3>{connector.name}</h3>
              <p>{connector.lastError ?? connectorHelpText(connector)}</p>
              {connector.type === 'email' ? (
                <p className="connector-scope-summary">Gmail needs gmail.readonly, gmail.compose, and gmail.send after explicit approval.</p>
              ) : null}
              {connector.type === 'calendar' ? (
                <p className="connector-scope-summary">Calendar uses calendar.events.owned for MVP writes.</p>
              ) : null}
              {connector.allowedAgents.length ? (
                <div className="connector-agents" aria-label={`${connector.name} allowed agents`}>
                  {connector.allowedAgents.map((agentId) => (
                    <span key={agentId}>{agentId}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="connector-statuses" aria-label={`${connector.name} statuses`}>
              <span>{connector.mode}</span>
              <span>{connector.authStatus}</span>
              <span>{connector.healthStatus}</span>
            </div>
            <div className="connector-actions">
              <button
                aria-label={`Check ${connector.name}`}
                className="icon-button"
                onClick={() => onHealthCheck(connector.id)}
                type="button"
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
              {connector.enabled ? (
                <button
                  aria-label={`Disconnect ${connector.name}`}
                  className="icon-button"
                  onClick={() => onDisconnect(connector.id)}
                  type="button"
                >
                  <Unplug size={16} aria-hidden="true" />
                </button>
              ) : (
                <>
                  {connector.type === 'email' ? (
                    <button
                      className="connector-enable-button"
                      onClick={() => onUpdate(connector.id, googleWorkspaceUpdate('email'))}
                      type="button"
                    >
                      Connect Gmail
                    </button>
                  ) : null}
                  {connector.type === 'calendar' ? (
                    <button
                      className="connector-enable-button"
                      onClick={() => onUpdate(connector.id, googleWorkspaceUpdate('calendar'))}
                      type="button"
                    >
                      Set up Calendar
                    </button>
                  ) : null}
                  <button
                    className="connector-enable-button connector-enable-button--secondary"
                    onClick={() => onUpdate(connector.id, fixtureUpdate(connector))}
                    type="button"
                  >
                    Enable {connector.name} fixture mode
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function fixtureUpdate(connector: ConnectorConfig): Partial<ConnectorConfig> {
  return {
    allowedAgents: connector.type === 'web_search' ? ['research-agent'] : connector.type === 'local_files' ? ['coding-agent'] : ['email-calendar-assistant'],
    enabled: true,
    mode: 'fixture',
    authStatus: 'ready',
    healthStatus: 'healthy'
  };
}

function googleWorkspaceUpdate(type: 'calendar' | 'email'): Partial<ConnectorConfig> {
  const config = type === 'email' ? RENDERER_GMAIL_SETUP : RENDERER_CALENDAR_SETUP;

  return {
    allowedAgents: ['email-calendar-assistant'],
    authStatus: 'needs_auth',
    enabled: true,
    healthStatus: 'unhealthy',
    launchConfig: {
      httpUrl: config.httpUrl,
      oauth: {
        provider: 'google-workspace',
        scopes: [...config.scopes]
      }
    },
    mode: 'real',
    requiredApproval: 'preview_sensitive_actions'
  };
}

function connectorHelpText(connector: ConnectorConfig) {
  if (connector.authStatus === 'ready') {
    return connector.enabled ? 'Connected and available to approved agents.' : 'Configured but disabled.';
  }

  if (connector.type === 'email') {
    return 'Connect Gmail or Outlook before reading email.';
  }

  if (connector.type === 'calendar') {
    return 'Connect Google or Outlook Calendar before checking events.';
  }

  if (connector.type === 'local_files') {
    return 'Choose approved folders before Bubbles reads project files.';
  }

  return 'Configure a search MCP provider or use MiniMax search fallback.';
}
