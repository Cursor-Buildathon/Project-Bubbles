export type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'waiting_approval'
  | 'confused'
  | 'concerned'
  | 'celebrating'
  | 'sleeping';

export type TaskType =
  | 'general.plan'
  | 'research.web'
  | 'coding.project'
  | 'coding.landing_page'
  | 'agent.create'
  | 'creative.image'
  | 'creative.music'
  | 'creative.video'
  | 'creative.minimax';

export interface ArtifactMetadata {
  id: string;
  kind: 'image' | 'audio' | 'site' | 'video';
  path?: string;
  url?: string;
  title?: string;
}

export type ApprovalRisk = 'low' | 'medium' | 'high';

export type ConnectorType = 'tavily_research';
export type ConnectorMode = 'real';
export type ConnectorAuthStatus = 'not_configured' | 'needs_auth' | 'ready' | 'error';
export type ConnectorHealthStatus = 'unknown' | 'healthy' | 'unhealthy';

export interface ConnectorLaunchConfig {
  remoteUrl?: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

export interface ConnectorConfig {
  id: string;
  name: string;
  type: ConnectorType;
  enabled: boolean;
  mode: ConnectorMode;
  authStatus: ConnectorAuthStatus;
  healthStatus: ConnectorHealthStatus;
  allowedAgents: string[];
  requiredApproval: 'none' | 'preview_sensitive_actions' | 'preview_all_actions';
  launchConfig: ConnectorLaunchConfig;
  lastCheckedAt?: string;
  lastError?: string;
  updatedAt: string;
}

export interface ConnectorHealth {
  healthStatus: ConnectorHealthStatus;
  authStatus?: ConnectorAuthStatus;
  lastError?: string;
}

export interface AgentProfile {
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

export interface AgentBirthDraft {
  profile: AgentProfile;
  skillsMarkdown: string;
}

export interface TaskPacket {
  taskId: string;
  userText: string;
  activeAgentId: string;
  taskType: TaskType;
  mode: 'plan_only' | 'plan_then_act' | 'act_after_approval';
  memoryContext: MemoryItem[];
  skillsMarkdown: string;
  allowedTools: string[];
  connectorContext?: Record<string, unknown>;
  approvalPolicy: 'none' | 'preview_sensitive_actions' | 'preview_all_actions';
  outputPreference: {
    userLevel: 'nontechnical';
    responseStyle: 'clear_spoken_summary' | 'structured_report' | 'concise_status';
    includeTechnicalDetails: boolean;
  };
}

export interface TaskEvent {
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

export interface ApprovalRequest {
  id: string;
  taskId: string;
  agentId: string;
  actionType:
    | 'file_write'
    | 'shell_command'
    | 'agent_file_create'
    | 'external_data_send';
  risk: ApprovalRisk;
  title: string;
  explanation: string;
  preview: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  createdAt: string;
  resolvedAt?: string;
}

export interface MemoryItem {
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

export interface MemoryQuery {
  type?: MemoryItem['type'];
  agentId?: string;
  tags?: string[];
  limit?: number;
}

export type TimelineEventType =
  | 'agent_created'
  | 'agent_activated'
  | 'memory_created'
  | 'memory_cleared'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'approval_decision';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  summary: string;
  taskId?: string;
  agentId?: string;
  memoryId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
