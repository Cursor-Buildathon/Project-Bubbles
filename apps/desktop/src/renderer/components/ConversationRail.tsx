import { type AgentBirthDraft, type AgentProfile } from '@bubbles/core';
import { AgentSwitcher } from './AgentSwitcher';
import { ConversationHistory } from './ConversationHistory';
import { AgentBirthPreview } from '../screens/AgentBirthPreview';

interface ConversationRailProps {
  activeAgent: AgentProfile | null;
  availableAgents: AgentProfile[];
  onActivateAgent: (agentId: string) => void;
  onCreateAgent: (draft: AgentBirthDraft) => Promise<AgentProfile>;
  onPreviewAgentBirth: (request: string) => Promise<AgentBirthDraft>;
}

export function ConversationRail({
  activeAgent,
  availableAgents,
  onActivateAgent,
  onCreateAgent,
  onPreviewAgentBirth
}: ConversationRailProps) {
  return (
    <aside className="conversation-rail" data-testid="conversation-rail" aria-label="Conversation and agent rail">
      <ConversationHistory />
      <AgentSwitcher
        activeAgentId={activeAgent?.id ?? 'general-assistant'}
        agents={availableAgents}
        onActivate={onActivateAgent}
      />
      <AgentBirthPreview onCreate={onCreateAgent} onPreview={onPreviewAgentBirth} />
    </aside>
  );
}
