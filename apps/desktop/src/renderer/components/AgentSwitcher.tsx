import { Bot } from 'lucide-react';
import { type AgentProfile } from '@bubbles/core';

interface AgentSwitcherProps {
  activeAgentId: string;
  agents: AgentProfile[];
  onActivate: (agentId: string) => void;
}

export function AgentSwitcher({ activeAgentId, agents, onActivate }: AgentSwitcherProps) {
  return (
    <section className="agent-switcher" data-testid="agent-switcher" aria-label="Agents">
      <h2>
        <Bot size={16} aria-hidden="true" />
        Agents
      </h2>
      <div className="agent-switcher__list">
        {agents.map((agent) => (
          <button
            aria-label={`Activate ${agent.name}`}
            className={agent.id === activeAgentId ? 'agent-chip agent-chip--active' : 'agent-chip'}
            key={agent.id}
            onClick={() => onActivate(agent.id)}
            type="button"
          >
            <span>{agent.badgeName}</span>
            <small>{agent.role}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
