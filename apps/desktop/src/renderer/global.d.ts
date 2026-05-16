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
  artifacts?: Array<{ id: string; kind: 'image' | 'audio' | 'site'; path?: string; url?: string; title?: string }>;
  citations?: Array<{ title: string; url: string; snippet?: string }>;
  text: string;
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
  taskEvents: CliEvent[];
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

interface VoiceSessionState {
  enabled: boolean;
  mode: 'push-to-talk' | 'always-listening';
  provider: 'native-macos' | 'fixture-transcript';
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  activeTurnId?: string;
  partialText: string;
  captionText: string;
  lastError?: string;
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
    | 'send_email'
    | 'calendar_update'
    | 'file_write'
    | 'shell_command'
    | 'cli_install'
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
  type: 'web_search' | 'local_files' | 'email' | 'calendar';
  enabled: boolean;
  mode: 'real' | 'fixture';
  authStatus: 'not_configured' | 'needs_auth' | 'ready' | 'error';
  healthStatus: 'unknown' | 'healthy' | 'unhealthy';
  allowedAgents: string[];
  requiredApproval: 'none' | 'preview_sensitive_actions' | 'preview_all_actions';
  launchConfig: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    approvedRoots?: string[];
    fixture?: Record<string, unknown>;
  };
  lastCheckedAt?: string;
  lastError?: string;
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
  skillsMarkdown: string;
}

interface CliEvent {
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
  | 'needs_general_api_key'
  | 'verifying_general_api'
  | 'needs_token_plan_key'
  | 'checking_cli'
  | 'needs_cli_install'
  | 'authenticating_cli'
  | 'verifying_cli'
  | 'ready'
  | 'setup_error';

interface SetupStatus {
  state: SetupState;
  mode: 'not_configured' | 'full';
  generalApi: {
    verified: boolean;
    lastCheckedAt?: string;
    error?: string;
  };
  tokenPlan: {
    present: boolean;
    verified: boolean;
    lastCheckedAt?: string;
    error?: string;
  };
  cli: {
    installed: boolean;
    path?: string;
    authenticated: boolean;
    verified: boolean;
    installCommandPreview: string;
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
        resolveApproval?: (input: {
          approvalId?: string;
          voiceTurnId: string;
          transcript: string;
        }) => Promise<ApprovalVoiceResolution>;
        speak?: (input: { text: string; ttsId: string }) => Promise<{ ok: boolean; ttsId: string; error?: string }>;
        startSession: () => Promise<VoiceIpcResult>;
        stopSession: () => Promise<VoiceSessionState>;
        stopSpeaking?: (input?: { ttsId?: string }) => Promise<{ ok: boolean; ttsId: string; error?: string }>;
        submitPartialTranscript: (input: {
          text: string;
          confidence?: number;
          provider?: 'native-macos' | 'fixture-transcript';
        }) => Promise<VoiceIpcResult>;
        submitTranscript: (input: {
          text: string;
          confidence?: number;
          provider?: 'native-macos' | 'fixture-transcript';
        }) => Promise<VoiceIpcResult>;
      };
      connectors?: {
        disconnect: (id: string) => Promise<ConnectorConfig[]>;
        healthCheck: (id: string) => Promise<ConnectorConfig[]>;
        list: () => Promise<ConnectorConfig[]>;
        update: (id: string, input: Partial<ConnectorConfig>) => Promise<ConnectorConfig[]>;
      };
      capabilities?: {
        openArtifact: (input: { path?: string; url?: string }) => Promise<{ ok: boolean; error?: string }>;
      };
      sendMessage: (userText: string) => Promise<Partial<BubblesAppState>>;
      setAvatarState: (avatarState: AvatarState) => Promise<Partial<BubblesAppState>>;
      setup: {
        getStatus: () => Promise<SetupStatus>;
        installCli: () => Promise<SetupStatus>;
        onStatusChange?: (callback: (status: SetupStatus) => void) => () => void;
        resetAllMiniMax: () => Promise<SetupStatus>;
        resetGeneralApiKey: () => Promise<SetupStatus>;
        resetTokenPlanKey: () => Promise<SetupStatus>;
        retry: () => Promise<SetupStatus>;
        saveGeneralApiKey: (apiKey: string) => Promise<SetupStatus>;
        saveTokenPlanKey: (apiKey: string) => Promise<SetupStatus>;
      };
      tasks?: {
        cancel: (taskId: string) => Promise<boolean>;
        getEvents: () => Promise<CliEvent[]>;
        onEvent: (callback: (event: CliEvent) => void) => () => void;
        start: (userText: string) => Promise<{ taskId: string }>;
      };
      togglePanel: () => Promise<{ isOpen: boolean }>;
    };
  }
}
