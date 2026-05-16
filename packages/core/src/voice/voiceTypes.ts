import { type TaskType } from '../shared/types.js';

export interface AffectTag {
  primary: 'neutral' | 'frustrated' | 'confused' | 'urgent' | 'satisfied' | 'stuck';
  confidence: number;
  urgency: 0 | 1 | 2 | 3;
  evidence: string[];
  ttsStyle: 'warm' | 'calm' | 'brief' | 'encouraging' | 'focused';
}

export type VoiceEvent =
  | { type: 'voice.session_started'; voiceTurnId: string; traceId: string }
  | { type: 'voice.partial'; voiceTurnId: string; text: string; confidence?: number }
  | { type: 'voice.final'; voiceTurnId: string; text: string; confidence?: number; affect?: AffectTag }
  | { type: 'voice.barge_in'; voiceTurnId: string; stoppedTtsId?: string }
  | { type: 'voice.error'; voiceTurnId?: string; error: string; provider: string };

export interface IntentClassificationV2 {
  taskType: TaskType | 'voice.approval' | 'mcp.configure' | 'creative.image' | 'creative.music' | 'coding.landing_page';
  suggestedAgentId: string;
  confidence: number;
  slots: Record<string, unknown>;
  requiresApproval?: boolean;
  missingSlots?: string[];
}

export interface VoiceTurnContext {
  voiceTurnId: string;
  traceId: string;
  inputMode: 'voice' | 'typed';
  sttProvider?: string;
  affect?: AffectTag;
  spokenSummaryPreferred: boolean;
  locale?: string;
  timezone?: string;
}

export interface ApprovalVoiceDecision {
  approvalId: string;
  voiceTurnId: string;
  decision: 'approved' | 'denied' | 'cancelled' | 'unclear' | 'timeout';
  transcript?: string;
  confidence?: number;
}

export interface AgentBirthVoiceRequest {
  requestText: string;
  voiceContext?: VoiceTurnContext;
  previewOnly: true;
}

export interface McpToolInvocation {
  connectorId: 'tavily-research';
  transport: 'command-jsonrpc' | 'http-oauth';
  method: string;
  params: Record<string, unknown>;
  traceId: string;
  approvalId?: string;
}

export interface CapabilityOutput {
  taskType: string;
  status: 'completed' | 'blocked' | 'needs_approval' | 'failed';
  chatText: string;
  voiceText: string;
  citations?: Array<{ title: string; url: string; snippet?: string }>;
  artifacts?: Array<{ id: string; kind: 'image' | 'audio' | 'site'; path?: string; url?: string }>;
  nextStep?: string;
}

export type VoiceSessionMode = 'push-to-talk' | 'always-listening';
export type VoiceSessionStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
export type VoiceProvider = 'gemini' | 'openai' | 'fixture-transcript';

export interface VoiceSessionState {
  enabled: boolean;
  mode: VoiceSessionMode;
  provider: VoiceProvider;
  status: VoiceSessionStatus;
  activeTurnId?: string;
  partialText: string;
  captionText: string;
  lastError?: string;
}

export function createInitialVoiceSessionState(input: Partial<VoiceSessionState> = {}): VoiceSessionState {
  return {
    enabled: input.enabled ?? false,
    mode: input.mode ?? 'push-to-talk',
    provider: input.provider ?? 'gemini',
    status: input.status ?? 'idle',
    activeTurnId: input.activeTurnId,
    partialText: input.partialText ?? '',
    captionText: input.captionText ?? '',
    lastError: input.lastError
  };
}
