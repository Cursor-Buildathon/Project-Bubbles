import { PlugZap, RefreshCw, Trash2 } from 'lucide-react';
import { type ConnectorConfig } from '@bubbles/core';

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
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              ) : (
                <button
                  className="connector-enable-button"
                  onClick={() => onUpdate(connector.id, tavilyUpdate())}
                  type="button"
                >
                  Enable Tavily Research
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function tavilyUpdate(): Partial<ConnectorConfig> {
  return {
    allowedAgents: ['research-agent'],
    enabled: true,
    launchConfig: {
      maxResults: 8,
      remoteUrl: 'https://mcp.tavily.com/mcp/',
      searchDepth: 'advanced'
    },
    mode: 'real',
    requiredApproval: 'none'
  };
}

function connectorHelpText(connector: ConnectorConfig) {
  if (connector.authStatus === 'ready') {
    return connector.enabled ? 'Tavily live web research is ready.' : 'Tavily is configured but disabled.';
  }

  return 'Add a Tavily API key below, then enable Tavily Research for live cited reports.';
}
