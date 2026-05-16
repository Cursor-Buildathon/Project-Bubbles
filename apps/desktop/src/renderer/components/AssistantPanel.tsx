import { FormEvent, PointerEvent, useRef, useState } from 'react';
import { BookOpenText } from 'lucide-react';
import {
  type AgentBirthDraft,
  type AgentProfile,
  type ApprovalRequest,
  type ConnectorConfig,
  type MemoryItem,
  type SetupStatus,
  type TaskEvent,
  type TimelineEvent,
  type VoiceSessionState
} from '@bubbles/core';
import { avatarStates, type AvatarState } from '../../avatar/animationCatalog';
import { type ChatMessage } from '../App';
import { TaskDrawer } from './TaskDrawer';
import { ApprovalModal } from './ApprovalModal';
import { ChatSurface } from './ChatSurface';
import { ConversationRail } from './ConversationRail';
import { IntegrationStatusBar } from './IntegrationStatusBar';
import { VoiceControls } from './VoiceControls';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceStatusRail } from './WorkspaceStatusRail';

interface AssistantPanelProps {
  activeAgent: AgentProfile | null;
  avatarState: AvatarState;
  activeTaskId: string | null;
  approvals: ApprovalRequest[];
  availableAgents: AgentProfile[];
  chatEnabled: boolean;
  connectors: ConnectorConfig[];
  draft: string;
  memories: MemoryItem[];
  messages: ChatMessage[];
  onActivateAgent: (agentId: string) => void;
  onApproveApproval: (id: string) => void;
  onCancelApproval: (id: string) => void;
  onCancelTask: (taskId: string) => void;
  onClearMemory: () => void;
  onConnectorDisconnect: (id: string) => void;
  onConnectorHealthCheck: (id: string) => void;
  onConnectorUpdate: (id: string, input: Partial<ConnectorConfig>) => void;
  onClose: () => void;
  onCreateAgent: (draft: AgentBirthDraft) => Promise<AgentProfile>;
  onDenyApproval: (id: string) => void;
  onDraftChange: (value: string) => void;
  onPreviewAgentBirth: (request: string) => Promise<AgentBirthDraft>;
  onSetAvatarState: (state: AvatarState) => void;
  onSetupStatusChange: (status: SetupStatus) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setupStatus: SetupStatus | null;
  taskEvents: TaskEvent[];
  timelineEvents: TimelineEvent[];
  voiceSession: {
    voiceState: VoiceSessionState;
    wakePhrase: string;
    wakePhraseEnabled: boolean;
    startListening: () => Promise<void>;
    stopListening: () => Promise<void>;
    bargeIn: () => Promise<void>;
    toggleWakePhrase: () => Promise<void>;
  };
}

export function AssistantPanel({
  activeAgent,
  activeTaskId,
  approvals,
  avatarState,
  availableAgents,
  chatEnabled,
  connectors,
  draft,
  memories,
  messages,
  onActivateAgent,
  onApproveApproval,
  onCancelApproval,
  onCancelTask,
  onClearMemory,
  onConnectorDisconnect,
  onConnectorHealthCheck,
  onConnectorUpdate,
  onClose,
  onCreateAgent,
  onDenyApproval,
  onDraftChange,
  onPreviewAgentBirth,
  onSetAvatarState,
  onSetupStatusChange,
  onSubmit,
  setupStatus,
  taskEvents,
  timelineEvents,
  voiceSession
}: AssistantPanelProps) {
  const [devControlsOpen, setDevControlsOpen] = useState(false);
  const hasPendingApprovals = approvals.some((approval) => approval.status === 'pending');
  const dragRef = useRef({
    active: false,
    x: 0,
    y: 0
  });

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.target instanceof Element && event.target.closest('button')) {
      return;
    }

    const pointer = getPointerPosition(event);
    dragRef.current = {
      active: true,
      x: pointer.x,
      y: pointer.y
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag.active) {
      return;
    }

    const pointer = getPointerPosition(event);
    const delta = {
      x: pointer.x - drag.x,
      y: pointer.y - drag.y
    };

    if (Math.abs(delta.x) + Math.abs(delta.y) < 2) {
      return;
    }

    dragRef.current = {
      active: true,
      x: pointer.x,
      y: pointer.y
    };
    void window.bubbles?.moveWindowBy(delta);
  }

  function handlePointerUp() {
    dragRef.current.active = false;
  }

  return (
    <aside className="assistant-panel" data-testid="assistant-panel" aria-label="Bubbles assistant panel">
      <WorkspaceHeader
        activeAgent={activeAgent}
        connectors={connectors}
        onClose={onClose}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        setupStatus={setupStatus}
      />

      <IntegrationStatusBar
        connectors={connectors}
        memories={memories}
        setupStatus={setupStatus}
        voiceState={voiceSession.voiceState}
      />

      <div className="workspace-shell" data-testid="workspace-shell">
        <ConversationRail
          activeAgent={activeAgent}
          availableAgents={availableAgents}
          onActivateAgent={onActivateAgent}
          onCreateAgent={onCreateAgent}
          onPreviewAgentBirth={onPreviewAgentBirth}
        />

        <main className="workspace-main" aria-label="Chat and task workspace">
          <ChatSurface
            chatEnabled={chatEnabled}
            draft={draft}
            messages={messages}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
          />
          <VoiceControls
            chatEnabled={chatEnabled}
            onBargeIn={() => void voiceSession.bargeIn()}
            onStartListening={() => void voiceSession.startListening()}
            onStopListening={() => void voiceSession.stopListening()}
            onToggleWakePhrase={() => void voiceSession.toggleWakePhrase()}
            voiceState={voiceSession.voiceState}
            wakePhrase={voiceSession.wakePhrase}
            wakePhraseEnabled={voiceSession.wakePhraseEnabled}
          />
          <TaskDrawer activeTaskId={activeTaskId} events={taskEvents} onCancelTask={onCancelTask} />
          <section className="approval-panel" aria-label="Approvals" data-testid="approval-panel">
            <div className="approval-panel__header">
              <h2>Approvals</h2>
              <span>{hasPendingApprovals ? 'Pending review' : 'Clear'}</span>
            </div>
            {hasPendingApprovals ? (
              <ApprovalModal
                approvals={approvals}
                onApprove={onApproveApproval}
                onCancel={onCancelApproval}
                onDeny={onDenyApproval}
              />
            ) : (
              <p className="empty-text">No pending approvals.</p>
            )}
          </section>
        </main>

        <WorkspaceStatusRail
          connectors={connectors}
          memories={memories}
          onClearMemory={onClearMemory}
          onConnectorDisconnect={onConnectorDisconnect}
          onConnectorHealthCheck={onConnectorHealthCheck}
          onConnectorUpdate={onConnectorUpdate}
          onSetupStatusChange={onSetupStatusChange}
          setupStatus={setupStatus}
          timelineEvents={timelineEvents}
          voiceState={voiceSession.voiceState}
        />
      </div>

      <section className="developer-controls developer-controls--collapsed" aria-label="Avatar state controls">
        <button className="developer-controls__toggle" type="button" onClick={() => setDevControlsOpen((current) => !current)}>
          <BookOpenText size={16} aria-hidden="true" />
          Developer controls
        </button>
        {devControlsOpen ? (
          <div className="state-controls">
            {avatarStates.map((state) => (
              <button
                className={state === avatarState ? 'state-button state-button--active' : 'state-button'}
                key={state}
                onClick={() => onSetAvatarState(state)}
                type="button"
              >
                {state.replace('_', ' ')}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </aside>
  );
}

function getPointerPosition(event: PointerEvent<HTMLElement>) {
  const screenX = Number(event.screenX);
  const screenY = Number(event.screenY);

  return {
    x: Number.isFinite(screenX) && screenX !== 0 ? screenX : event.clientX,
    y: Number.isFinite(screenY) && screenY !== 0 ? screenY : event.clientY
  };
}
