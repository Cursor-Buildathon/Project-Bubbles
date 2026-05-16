/// <reference types="vite/client" />

import type {
	AgentListResponse,
	AgentRunRequest,
	AgentRunResponse,
	AgentStreamChunk,
	AudioAmplitudePayload,
	AudioPlayPayload,
	AvatarSetMoodPayload,
	AvatarSetSkinPayload,
	DebugHasApiKeyResponse,
	DebugSetApiKeyResponse,
	FilePeekRequest,
	FilePeekResponse,
	MemoryQueryRequest,
	MemoryQueryResponse,
	NeedsOnboardingResponse,
	PermissionRequest,
	PickFolderResponse,
	SetCostCapRequest,
	SpendSummaryRequest,
	SpendSummaryResponse,
} from "@bubbles/shared-types";

type UnsubscribeFn = () => void;

declare global {
	interface Window {
		bubbles: {
			agent: {
				run: (req: AgentRunRequest) => Promise<AgentRunResponse>;
				onStream: (
					turnId: string,
					cb: (chunk: AgentStreamChunk) => void,
				) => UnsubscribeFn;
				list: () => Promise<AgentListResponse>;
				setSkin: (agentId: string) => void;
				lastConversation: () => Promise<{
					conversationId: string;
					agentId: string;
				}>;
			};
			memory: {
				query: (req: MemoryQueryRequest) => Promise<MemoryQueryResponse>;
			};
			audio: {
				onPlay: (cb: (payload: AudioPlayPayload) => void) => UnsubscribeFn;
				sendAmplitude: (payload: AudioAmplitudePayload) => void;
				onAmplitude: (
					cb: (payload: AudioAmplitudePayload) => void,
				) => UnsubscribeFn;
			};
			avatar: {
				onMoodChange: (
					cb: (payload: AvatarSetMoodPayload) => void,
				) => UnsubscribeFn;
				setIgnoreMouse: (ignore: boolean) => void;
				onSkinChange: (
					cb: (payload: AvatarSetSkinPayload) => void,
				) => UnsubscribeFn;
				toggleChat: () => void;
				dragStart: () => void;
				dragMove: (dx: number, dy: number) => void;
				dragEnd: () => void;
			};
			app: {
				needsOnboarding: () => Promise<NeedsOnboardingResponse>;
				pickFolder: () => Promise<PickFolderResponse>;
				closeChat: () => void;
			};
			debug: {
				hasApiKey: () => Promise<DebugHasApiKeyResponse>;
				setApiKey: (key: string) => Promise<DebugSetApiKeyResponse>;
			};
			file: {
				peek: (req: FilePeekRequest) => Promise<FilePeekResponse>;
			};
			settings: {
				getSpendSummary: (
					req: SpendSummaryRequest,
				) => Promise<SpendSummaryResponse>;
				setCostCap: (req: SetCostCapRequest) => Promise<{ ok: boolean }>;
			};
			permission: {
				onRequest: (cb: (req: PermissionRequest) => void) => UnsubscribeFn;
				respond: (
					requestId: string,
					decision: "allow" | "deny" | "allow_always",
				) => void;
			};
		};
	}
}
