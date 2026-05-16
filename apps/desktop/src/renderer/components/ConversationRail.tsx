import { type AgentProfile } from '@bubbles/core';
import { AgentSwitcher } from './AgentSwitcher';
import { ConversationHistory } from './ConversationHistory';

interface ConversationRailProps {
  activeAgent: AgentProfile | null;
  availableAgents: AgentProfile[];
  onActivateAgent: (agentId: string) => void;
}

export function ConversationRail({
  activeAgent,
  availableAgents,
  onActivateAgent
}: ConversationRailProps) {
  return (
    <aside className="conversation-rail" data-testid="conversation-rail" aria-label="Conversation and agent rail">
      <ConversationHistory />
      <AgentSwitcher
        activeAgentId={activeAgent?.id ?? 'general-assistant'}
        agents={availableAgents}
        onActivate={onActivateAgent}
      />
    </aside>
  );
}
