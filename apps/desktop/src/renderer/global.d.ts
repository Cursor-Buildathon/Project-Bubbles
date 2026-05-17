export {};

type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'waiting_approval'
  | 'confused'
  | 'concerned'
  | 'celebrating'
  | 'sleeping';

interface ChatMessage {
  id: number;
  author: 'user' | 'bubbles';
  artifacts?: Array<{ id: string; kind: 'image' | 'audio' | 'site' | 'video'; path?: string; url?: string; title?: string }>;
  citations?: Array<{ title: string; url: string; snippet?: string }>;
  speakOnArrival?: boolean;
  text: string;
  voiceText?: string;
}

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

interface AffectTag {
  primary: 'neutral' | 'frustrated' | 'confused' | 'urgent' | 'satisfied' | 'stuck';
  confidence: number;
  urgency: 0 | 1 | 2 | 3;
  evidence: string[];
  ttsStyle: 'warm' | 'calm' | 'brief' | 'encouraging' | 'focused';
}

type VoiceEvent =
  | { type: 'voice.session_started'; voiceTurnId: string; traceId: string }
  | { type: 'voice.partial'; voiceTurnId: string; text: string; confidence?: number }
  | { type: 'voice.final'; voiceTurnId: string; text: string; confidence?: number; affect?: AffectTag }
  | { type: 'voice.barge_in'; voiceTurnId: string; stoppedTtsId?: string }
  | { type: 'voice.error'; voiceTurnId?: string; error: string; provider: string };

type TranscriptionFailureReason = 'auth' | 'network' | 'not_configured' | 'provider' | 'quota' | 'rate_limit';

interface VoiceSessionState {
  enabled: boolean;
  mode: 'push-to-talk' | 'always-listening';
  provider: 'gemini' | 'openai' | 'fixture-transcript';
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  activeTurnId?: string;
  partialText: string;
  captionText: string;
  lastError?: string;
}

interface VoiceProviderSetupStatus {
  present: boolean;
  verified: boolean;
  error?: string;
}

interface VoiceSetupStatus {
  enabled: boolean;
  stt: {
    ready: boolean;
    preferredProvider?: 'gemini' | 'openai';
    gemini: VoiceProviderSetupStatus;
    openai: VoiceProviderSetupStatus;
  };
  tts: {
    provider: 'minimax';
    ready: boolean;
  };
  updatedAt: string;
}

interface VoiceIpcResult {
  event: VoiceEvent;
  state: VoiceSessionState;
}

interface ApprovalVoiceDecision {
  approvalId: string;
  voiceTurnId: string;
  decision: 'approved' | 'denied' | 'cancelled' | 'unclear' | 'timeout';
  transcript?: string;
  confidence?: number;
}

interface ApprovalVoiceResolution {
  decision: ApprovalVoiceDecision;
  resolvedApproval?: ApprovalRequest;
  message: string;
  fallbackRequired: boolean;
  attemptCount: number;
}

interface ApprovalRequest {
  id: string;
  taskId: string;
  agentId: string;
  actionType:
    | 'file_write'
    | 'shell_command'
    | 'agent_file_create'
    | 'external_data_send';
  risk: 'low' | 'medium' | 'high';
  title: string;
  explanation: string;
  preview: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  createdAt: string;
  resolvedAt?: string;
}

interface ConnectorConfig {
  id: string;
  name: string;
  type: 'tavily_research';
  enabled: boolean;
  mode: 'real';
  authStatus: 'not_configured' | 'needs_auth' | 'ready' | 'error';
  healthStatus: 'unknown' | 'healthy' | 'unhealthy';
  allowedAgents: string[];
  requiredApproval: 'none' | 'preview_sensitive_actions' | 'preview_all_actions';
  launchConfig: {
    maxResults?: number;
    remoteUrl?: string;
    searchDepth?: 'basic' | 'advanced';
  };
  lastCheckedAt?: string;
  lastError?: string;
  updatedAt: string;
}

interface TavilySetupStatus {
  error?: string;
  state: 'needs_api_key' | 'verifying' | 'ready' | 'setup_error';
  updatedAt: string;
}

interface AgentProfile {
  id: string;
  name: string;
  role: string;
  badgeName: string;
  voiceStyle: string;
  allowedTools: string[];
  memoryRules: string[];
  safetyRules: string[];
  responseStyle: string;
  skillsPath: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

interface AgentBirthDraft {
  profile: AgentProfile;
  agentMarkdown: string;
  skillsMarkdown: string;
}

interface TaskEvent {
  taskId: string;
  type:
    | 'task.received'
    | 'task.status'
    | 'task.partial_output'
    | 'tool.requested'
    | 'approval.required'
    | 'approval.accepted'
    | 'approval.denied'
    | 'task.result'
    | 'task.error'
    | 'task.cancelled';
  payload: Record<string, unknown>;
  createdAt: string;
}

type SetupState =
  | 'needs_token_plan_key'
  | 'verifying_token_plan'
  | 'ready'
  | 'setup_error';

interface SetupStatus {
  state: SetupState;
  mode: 'not_configured' | 'full';
  tokenPlan: {
    present: boolean;
    verified: boolean;
    lastCheckedAt?: string;
    error?: string;
  };
  updatedAt: string;
}

interface MemoryItem {
  id: string;
  type:
    | 'user_preference'
    | 'project_context'
    | 'task_summary'
    | 'decision'
    | 'agent_history'
    | 'relationship'
    | 'connector_context'
    | 'approval_history';
  content: string;
  sourceTaskId?: string;
  agentId?: string;
  tags: string[];
  importance: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  updatedAt: string;
}

interface TimelineEvent {
  id: string;
  type:
    | 'agent_created'
    | 'agent_activated'
    | 'memory_created'
    | 'memory_cleared'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'task_cancelled'
    | 'approval_decision';
  title: string;
  summary: string;
  taskId?: string;
  agentId?: string;
  memoryId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

declare global {
  interface Window {
    bubbles?: {
      closePanel: () => Promise<{ isOpen: boolean }>;
      getState: () => Promise<Partial<BubblesAppState>>;
      moveWindowBy: (delta: { x: number; y: number }) => Promise<void>;
      onPanelStateChange: (callback: (isOpen: boolean) => void) => () => void;
      onStateChange: (callback: (state: Partial<BubblesAppState>) => void) => () => void;
      platform: NodeJS.Platform;
      phase: 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4-5' | 'phase-6-8';
      approvals?: {
        approve: (id: string) => Promise<ApprovalRequest[]>;
        cancel: (id: string) => Promise<ApprovalRequest[]>;
        create: (input: Partial<ApprovalRequest>) => Promise<ApprovalRequest[]>;
        deny: (id: string) => Promise<ApprovalRequest[]>;
        list: () => Promise<ApprovalRequest[]>;
      };
      agents?: {
        activate: (agentId: string) => Promise<Partial<BubblesAppState>>;
        createFromPreview: (draft: AgentBirthDraft) => Promise<AgentProfile>;
        list: () => Promise<AgentProfile[]>;
        previewBirth: (request: string) => Promise<AgentBirthDraft>;
      };
      memory?: {
        clear: () => Promise<Partial<BubblesAppState>>;
        list: () => Promise<MemoryItem[]>;
        timeline: () => Promise<TimelineEvent[]>;
      };
      logs?: {
        exportRedacted: () => Promise<{ path: string }>;
      };
      voice?: {
        bargeIn: (input?: { stoppedTtsId?: string }) => Promise<VoiceIpcResult>;
        getState: () => Promise<VoiceSessionState>;
        onEvent: (callback: (event: VoiceEvent, state: VoiceSessionState) => void) => () => void;
        onShortcutStart?: (callback: () => void) => () => void;
        openMicrophoneSettings?: () => Promise<{ ok: boolean; error?: string }>;
        requestMicrophoneAccess?: () => Promise<{ ok: boolean; status: 'granted' | 'denied' }>;
        resolveApproval?: (input: {
          approvalId?: string;
          voiceTurnId: string;
          transcript: string;
        }) => Promise<ApprovalVoiceResolution>;
        speak?: (input: {
          text: string;
          ttsId: string;
        }) => Promise<{ ok: boolean; ttsId: string; audioPath?: string; audioUrl?: string; error?: string; mimeType?: string }>;
        startSession: () => Promise<VoiceIpcResult>;
        stopSession: () => Promise<VoiceSessionState>;
        stopSpeaking?: (input?: { ttsId?: string }) => Promise<{ ok: boolean; ttsId: string; error?: string }>;
        submitPartialTranscript: (input: {
          text: string;
          confidence?: number;
          provider?: 'gemini' | 'openai' | 'fixture-transcript';
        }) => Promise<VoiceIpcResult>;
        submitTranscript: (input: {
          text: string;
          confidence?: number;
          provider?: 'gemini' | 'openai' | 'fixture-transcript';
        }) => Promise<VoiceIpcResult>;
        transcribeAudio?: (input: {
          audioDataUrl: string;
          mimeType: string;
          voiceTurnId?: string;
        }) => Promise<
          | { ok: true; event: VoiceEvent; provider: 'gemini' | 'openai' | 'fixture-transcript'; state: VoiceSessionState; transcript: string }
          | {
              ok: false;
              error: string;
              event: VoiceEvent;
              provider: 'gemini' | 'openai' | 'fixture-transcript';
              reason?: TranscriptionFailureReason;
              retryable?: boolean;
              state: VoiceSessionState;
            }
        >;
      };
      voiceSetup?: {
        getStatus: () => Promise<VoiceSetupStatus>;
        onStatusChange?: (callback: (status: VoiceSetupStatus) => void) => () => void;
        resetAllVoiceKeys: () => Promise<VoiceSetupStatus>;
        resetGeminiKey: () => Promise<VoiceSetupStatus>;
        resetOpenAiKey: () => Promise<VoiceSetupStatus>;
        saveGeminiKey: (apiKey: string) => Promise<VoiceSetupStatus>;
        saveOpenAiKey: (apiKey: string) => Promise<VoiceSetupStatus>;
      };
      tavilySetup?: {
        getStatus: () => Promise<TavilySetupStatus>;
        onStatusChange?: (callback: (status: TavilySetupStatus) => void) => () => void;
        resetApiKey: () => Promise<TavilySetupStatus>;
        retry: () => Promise<TavilySetupStatus>;
        saveApiKey: (apiKey: string) => Promise<TavilySetupStatus>;
      };
      connectors?: {
        disconnect: (id: string) => Promise<ConnectorConfig[]>;
        healthCheck: (id: string) => Promise<ConnectorConfig[]>;
        list: () => Promise<ConnectorConfig[]>;
        update: (id: string, input: Partial<ConnectorConfig>) => Promise<ConnectorConfig[]>;
      };
      capabilities?: {
        downloadArtifact: (input: { path?: string; title?: string; url?: string }) => Promise<{ ok: boolean; error?: string; path?: string }>;
        openArtifact: (input: { path?: string; url?: string }) => Promise<{ ok: boolean; error?: string }>;
      };
      sendMessage: (userText: string) => Promise<Partial<BubblesAppState>>;
      setAvatarState: (avatarState: AvatarState) => Promise<Partial<BubblesAppState>>;
      setup: {
        getStatus: () => Promise<SetupStatus>;
        onStatusChange?: (callback: (status: SetupStatus) => void) => () => void;
        resetAllMiniMax: () => Promise<SetupStatus>;
        resetTokenPlanKey: () => Promise<SetupStatus>;
        retry: () => Promise<SetupStatus>;
        saveTokenPlanKey: (apiKey: string) => Promise<SetupStatus>;
      };
      tasks?: {
        cancel: (taskId: string) => Promise<boolean>;
        getEvents: () => Promise<TaskEvent[]>;
        onEvent: (callback: (event: TaskEvent) => void) => () => void;
        start: (userText: string) => Promise<{ taskId: string }>;
      };
      togglePanel: () => Promise<{ isOpen: boolean }>;
    };
  }
}
