import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
import { AssistantPanel } from './components/AssistantPanel';
import { FloatingAvatarWindow } from './components/FloatingAvatarWindow';
import { type AvatarState } from '../avatar/animationCatalog';
import { useVoiceSession } from './voice/useVoiceSession';
import './styles.css';

export interface ChatMessage {
  id: number;
  author: 'user' | 'bubbles';
  artifacts?: Array<{ id: string; kind: 'image' | 'audio' | 'site' | 'video'; path?: string; url?: string; title?: string }>;
  citations?: Array<{ title: string; url: string; snippet?: string }>;
  speakOnArrival?: boolean;
  text: string;
  voiceText?: string;
}

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    author: 'bubbles',
    text: 'Hi, I am Bubbles. Click me when you want the full workspace.'
  }
];

interface BubblesAppState {
  activeTaskId: string | null;
  activeAgent: AgentProfile | null;
  approvals: ApprovalRequest[];
  avatarState: AvatarState;
  availableAgents: AgentProfile[];
  connectors: ConnectorConfig[];
  messages: ChatMessage[];
  recentMemories: MemoryItem[];
  taskEvents: TaskEvent[];
  timelineEvents: TimelineEvent[];
  voiceState: VoiceSessionState;
}

const initialAppState: BubblesAppState = {
  activeTaskId: null,
  activeAgent: null,
  approvals: [],
  avatarState: 'idle',
  availableAgents: [],
  connectors: [],
  messages: initialMessages,
  recentMemories: [],
  taskEvents: [],
  timelineEvents: [],
  voiceState: createRendererVoiceState({ enabled: true })
};

export function App() {
  const windowRole = new URLSearchParams(window.location.search).get('window') === 'panel' ? 'panel' : 'avatar';
  const [appState, setAppState] = useState<BubblesAppState>(initialAppState);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const {
    activeAgent,
    activeTaskId,
    approvals,
    avatarState,
    availableAgents,
    connectors,
    messages,
    recentMemories,
    taskEvents,
    timelineEvents
  } = appState;
  const chatEnabled = !window.bubbles?.setup || setupStatus?.state === 'ready';

  const latestBubbleMessage = useMemo(() => {
    return [...messages].reverse().find((message) => message.author === 'bubbles');
  }, [messages]);
  const latestBubbleText = latestBubbleMessage?.text ?? 'Ready when you are.';
  const latestBubbleVoiceText = latestBubbleMessage?.voiceText ?? latestBubbleText;
  const pendingApproval = useMemo(() => {
    const approval = approvals.find((candidate) => candidate.status === 'pending');
    return approval ? { id: approval.id, title: approval.title } : undefined;
  }, [approvals]);

  const submitUserText = useCallback(
    async (userText: string) => {
      const trimmedText = userText.trim();

      if (!trimmedText || !chatEnabled) {
        return;
      }

      if (window.bubbles?.sendMessage) {
        const state = await window.bubbles.sendMessage(trimmedText);
        setAppState(normalizeAppState(state));
      } else if (window.bubbles?.tasks?.start) {
        await window.bubbles.tasks.start(trimmedText);
      } else {
        const nextId = Date.now();
        setAppState((currentState) => ({
          ...currentState,
          avatarState: 'listening',
          messages: [
            ...currentState.messages,
            { id: nextId, author: 'user', text: trimmedText },
            {
              id: nextId + 1,
              author: 'bubbles',
              text: `I heard: ${trimmedText}`
            }
          ]
        }));
      }
    },
    [chatEnabled]
  );

  const voiceSession = useVoiceSession({
    chatEnabled,
    latestBubbleMessageId: latestBubbleMessage?.id,
    latestBubbleSpeakOnArrival: latestBubbleMessage?.speakOnArrival,
    latestBubbleText: latestBubbleVoiceText,
    pendingApproval,
    sideEffectsEnabled: windowRole === 'panel' || !window.bubbles,
    onApprovalResolved: refreshState,
    onTranscript: submitUserText
  });
  const displayAvatarState = voiceAvatarState(avatarState, voiceSession.voiceState);
  const displayBubbleText = voiceSession.voiceState.captionText || latestBubbleMessage?.voiceText || latestBubbleText;

  useEffect(() => {
    return window.bubbles?.onPanelStateChange((isOpen) => setPanelOpen(isOpen));
  }, []);

  useEffect(() => {
    let ignore = false;

    void window.bubbles?.setup?.getStatus().then((status) => {
      if (!ignore) {
        setSetupStatus(status);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    return window.bubbles?.setup?.onStatusChange?.((status) => setSetupStatus(status));
  }, []);

  useEffect(() => {
    let ignore = false;
    void window.bubbles?.getState().then((state) => {
      if (!ignore) {
        setAppState(normalizeAppState(state));
      }
    });
    const unsubscribe = window.bubbles?.onStateChange((state) => setAppState(normalizeAppState(state)));

    return () => {
      ignore = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    return window.bubbles?.tasks?.onEvent((event) => {
      setAppState((currentState) => ({
        ...currentState,
        taskEvents: currentState.taskEvents.some(
          (existingEvent) =>
            existingEvent.taskId === event.taskId &&
            existingEvent.type === event.type &&
            existingEvent.createdAt === event.createdAt
        )
          ? currentState.taskEvents
          : [...currentState.taskEvents, event]
      }));
    });
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitUserText(draft);
    setDraft('');
  }

  function setSharedAvatarState(nextAvatarState: AvatarState) {
    if (window.bubbles?.setAvatarState) {
      void window.bubbles.setAvatarState(nextAvatarState).then((state) => setAppState(normalizeAppState(state)));
      return;
    }

    setAppState((currentState) => ({
      ...currentState,
      avatarState: nextAvatarState
    }));
  }

  function handleCancelTask(taskId: string) {
    void window.bubbles?.tasks?.cancel(taskId);
  }

  function handleTogglePanel() {
    if (window.bubbles?.togglePanel) {
      void window.bubbles.togglePanel().then(({ isOpen }) => setPanelOpen(isOpen));
      return;
    }

    setPanelOpen((currentPanelOpen) => !currentPanelOpen);
  }

  function handleActivateAgent(agentId: string) {
    void window.bubbles?.agents?.activate(agentId).then((state) => setAppState(normalizeAppState(state)));
  }

  function handlePreviewAgentBirth(request: string) {
    return window.bubbles?.agents?.previewBirth(request) ?? Promise.reject(new Error('Agent birth is unavailable.'));
  }

  function handleCreateAgent(draft: AgentBirthDraft) {
    return (
      window.bubbles?.agents?.createFromPreview(draft).then(async (agent) => {
        const state = await window.bubbles?.getState();
        if (state) {
          setAppState(normalizeAppState(state));
        }
        return agent;
      }) ?? Promise.reject(new Error('Agent creation is unavailable.'))
    );
  }

  function handleClearMemory() {
    void window.bubbles?.memory?.clear().then((state) => setAppState(normalizeAppState(state)));
  }

  function refreshState() {
    void window.bubbles?.getState().then((state) => setAppState(normalizeAppState(state)));
  }

  function handleApproveApproval(id: string) {
    return window.bubbles?.approvals?.approve(id).then(refreshState) ?? Promise.resolve();
  }

  function handleDenyApproval(id: string) {
    return window.bubbles?.approvals?.deny(id).then(refreshState) ?? Promise.resolve();
  }

  function handleCancelApproval(id: string) {
    return window.bubbles?.approvals?.cancel(id).then(refreshState) ?? Promise.resolve();
  }

  function handleConnectorUpdate(id: string, input: Partial<ConnectorConfig>) {
    void window.bubbles?.connectors?.update(id, input).then(refreshState);
  }

  function handleConnectorHealthCheck(id: string) {
    void window.bubbles?.connectors?.healthCheck(id).then(refreshState);
  }

  function handleConnectorDisconnect(id: string) {
    void window.bubbles?.connectors?.disconnect(id).then(refreshState);
  }

  function handleClosePanel() {
    if (window.bubbles?.closePanel) {
      void window.bubbles.closePanel().then(({ isOpen }) => setPanelOpen(isOpen));
      return;
    }

    setPanelOpen(false);
  }

  if (windowRole === 'panel') {
    return (
      <main className="bubbles-shell bubbles-shell--panel">
        <AssistantPanel
          activeTaskId={activeTaskId}
          activeAgent={activeAgent}
          approvals={approvals}
          avatarState={displayAvatarState}
          availableAgents={availableAgents}
          draft={draft}
          chatEnabled={chatEnabled}
          connectors={connectors}
          messages={messages}
          memories={recentMemories}
          onActivateAgent={handleActivateAgent}
          onApproveApproval={handleApproveApproval}
          onCancelApproval={handleCancelApproval}
          onCancelTask={handleCancelTask}
          onClearMemory={handleClearMemory}
          onConnectorDisconnect={handleConnectorDisconnect}
          onConnectorHealthCheck={handleConnectorHealthCheck}
          onConnectorUpdate={handleConnectorUpdate}
          onClose={handleClosePanel}
          onCreateAgent={handleCreateAgent}
          onDenyApproval={handleDenyApproval}
          onDraftChange={setDraft}
          onPreviewAgentBirth={handlePreviewAgentBirth}
          onSetAvatarState={setSharedAvatarState}
          onSetupStatusChange={setSetupStatus}
          onSubmit={handleSubmit}
          setupStatus={setupStatus}
          taskEvents={taskEvents}
          timelineEvents={timelineEvents}
          voiceSession={voiceSession}
        />
      </main>
    );
  }

  return (
    <main className="bubbles-shell">
      <FloatingAvatarWindow
        activeAgentBadge={activeAgent?.badgeName ?? 'Bubbles'}
        avatarState={displayAvatarState}
        latestBubbleText={displayBubbleText}
        onTogglePanel={handleTogglePanel}
        panelOpen={panelOpen}
      />

      {!window.bubbles && panelOpen ? (
        <AssistantPanel
          activeTaskId={activeTaskId}
          activeAgent={activeAgent}
          approvals={approvals}
          avatarState={displayAvatarState}
          availableAgents={availableAgents}
          draft={draft}
          chatEnabled={chatEnabled}
          connectors={connectors}
          messages={messages}
          memories={recentMemories}
          onActivateAgent={handleActivateAgent}
          onApproveApproval={handleApproveApproval}
          onCancelApproval={handleCancelApproval}
          onCancelTask={handleCancelTask}
          onClearMemory={handleClearMemory}
          onConnectorDisconnect={handleConnectorDisconnect}
          onConnectorHealthCheck={handleConnectorHealthCheck}
          onConnectorUpdate={handleConnectorUpdate}
          onClose={handleClosePanel}
          onCreateAgent={handleCreateAgent}
          onDenyApproval={handleDenyApproval}
          onDraftChange={setDraft}
          onPreviewAgentBirth={handlePreviewAgentBirth}
          onSetAvatarState={setSharedAvatarState}
          onSetupStatusChange={setSetupStatus}
          onSubmit={handleSubmit}
          setupStatus={setupStatus}
          taskEvents={taskEvents}
          timelineEvents={timelineEvents}
          voiceSession={voiceSession}
        />
      ) : null}
    </main>
  );
}

function normalizeAppState(state: Partial<BubblesAppState> | undefined): BubblesAppState {
  return {
    activeTaskId: state?.activeTaskId ?? null,
    activeAgent: state?.activeAgent ?? null,
    approvals: state?.approvals ?? [],
    avatarState: state?.avatarState ?? initialAppState.avatarState,
    availableAgents: state?.availableAgents ?? [],
    connectors: state?.connectors ?? [],
    messages: state?.messages ?? initialAppState.messages,
    recentMemories: state?.recentMemories ?? [],
    taskEvents: state?.taskEvents ?? [],
    timelineEvents: state?.timelineEvents ?? [],
    voiceState: state?.voiceState ?? initialAppState.voiceState
  };
}

function voiceAvatarState(current: AvatarState, voiceState: VoiceSessionState): AvatarState {
  if (voiceState.status === 'listening') {
    return 'listening';
  }

  if (voiceState.status === 'processing') {
    return 'thinking';
  }

  if (voiceState.status === 'speaking') {
    return 'working';
  }

  if (voiceState.status === 'error') {
    return 'concerned';
  }

  return current;
}

function createRendererVoiceState(overrides: Partial<VoiceSessionState> = {}): VoiceSessionState {
  return {
    enabled: false,
    mode: 'push-to-talk',
    provider: 'gemini',
    status: 'idle',
    activeTurnId: undefined,
    partialText: '',
    captionText: '',
    lastError: undefined,
    ...overrides
  };
}
