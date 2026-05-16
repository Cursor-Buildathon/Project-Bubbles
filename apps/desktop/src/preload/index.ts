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
import { IPC_CHANNELS } from "@bubbles/shared-types";
import { contextBridge, ipcRenderer } from "electron";

type UnsubscribeFn = () => void;

const api = {
	agent: {
		run: (req: AgentRunRequest): Promise<AgentRunResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.AGENT_RUN, req),

		onStream: (
			turnId: string,
			cb: (chunk: AgentStreamChunk) => void,
		): UnsubscribeFn => {
			const channel = IPC_CHANNELS.AGENT_STREAM(turnId);
			const handler = (
				_evt: Electron.IpcRendererEvent,
				chunk: AgentStreamChunk,
			) => cb(chunk);
			ipcRenderer.on(channel, handler);
			return () => ipcRenderer.removeListener(channel, handler);
		},

		list: (): Promise<AgentListResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.AGENT_LIST),

		setSkin: (agentId: string): void => {
			ipcRenderer.send(IPC_CHANNELS.AVATAR_SET_SKIN, { agentId });
		},

		lastConversation: (): Promise<{
			conversationId: string;
			agentId: string;
		}> => ipcRenderer.invoke(IPC_CHANNELS.AGENT_LAST_CONVERSATION),
	},

	memory: {
		query: (req: MemoryQueryRequest): Promise<MemoryQueryResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.MEMORY_QUERY, req),
	},

	audio: {
		onPlay: (cb: (payload: AudioPlayPayload) => void): UnsubscribeFn => {
			const handler = (
				_evt: Electron.IpcRendererEvent,
				payload: AudioPlayPayload,
			) => cb(payload);
			ipcRenderer.on(IPC_CHANNELS.AUDIO_PLAY, handler);
			return () => ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_PLAY, handler);
		},
		sendAmplitude: (payload: AudioAmplitudePayload): void => {
			ipcRenderer.send(IPC_CHANNELS.AUDIO_AMPLITUDE, payload);
		},
		onAmplitude: (
			cb: (payload: AudioAmplitudePayload) => void,
		): UnsubscribeFn => {
			const handler = (
				_evt: Electron.IpcRendererEvent,
				payload: AudioAmplitudePayload,
			) => cb(payload);
			ipcRenderer.on(IPC_CHANNELS.AUDIO_AMPLITUDE_BROADCAST, handler);
			return () =>
				ipcRenderer.removeListener(
					IPC_CHANNELS.AUDIO_AMPLITUDE_BROADCAST,
					handler,
				);
		},
	},

	avatar: {
		onMoodChange: (
			cb: (payload: AvatarSetMoodPayload) => void,
		): UnsubscribeFn => {
			const handler = (
				_evt: Electron.IpcRendererEvent,
				payload: AvatarSetMoodPayload,
			) => cb(payload);
			ipcRenderer.on(IPC_CHANNELS.AVATAR_SET_MOOD, handler);
			return () =>
				ipcRenderer.removeListener(IPC_CHANNELS.AVATAR_SET_MOOD, handler);
		},

		setIgnoreMouse: (ignore: boolean): void => {
			ipcRenderer.send(IPC_CHANNELS.AVATAR_SET_IGNORE_MOUSE, { ignore });
		},

		onSkinChange: (
			cb: (payload: AvatarSetSkinPayload) => void,
		): UnsubscribeFn => {
			const handler = (
				_evt: Electron.IpcRendererEvent,
				payload: AvatarSetSkinPayload,
			) => cb(payload);
			ipcRenderer.on(IPC_CHANNELS.AVATAR_SET_SKIN, handler);
			return () =>
				ipcRenderer.removeListener(IPC_CHANNELS.AVATAR_SET_SKIN, handler);
		},

		toggleChat: (): void => {
			ipcRenderer.send(IPC_CHANNELS.AVATAR_TOGGLE_CHAT);
		},

		dragStart: (): void => {
			ipcRenderer.send(IPC_CHANNELS.AVATAR_DRAG_START);
		},

		dragMove: (dx: number, dy: number): void => {
			ipcRenderer.send(IPC_CHANNELS.AVATAR_DRAG_MOVE, dx, dy);
		},

		dragEnd: (): void => {
			ipcRenderer.send(IPC_CHANNELS.AVATAR_DRAG_END);
		},
	},

	app: {
		needsOnboarding: (): Promise<NeedsOnboardingResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.DEBUG_NEEDS_ONBOARDING),
		pickFolder: (): Promise<PickFolderResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.APP_PICK_FOLDER),
		closeChat: (): void => {
			ipcRenderer.send(IPC_CHANNELS.APP_CLOSE_CHAT);
		},
	},

	debug: {
		hasApiKey: (): Promise<DebugHasApiKeyResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.DEBUG_HAS_API_KEY),
		setApiKey: (key: string): Promise<DebugSetApiKeyResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.DEBUG_SET_API_KEY, { key }),
	},

	file: {
		peek: (req: FilePeekRequest): Promise<FilePeekResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.FILE_PEEK, req),
	},

	settings: {
		getSpendSummary: (
			req: SpendSummaryRequest,
		): Promise<SpendSummaryResponse> =>
			ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_SPEND, req),
		setCostCap: (req: SetCostCapRequest): Promise<{ ok: boolean }> =>
			ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_CAP, req),
	},

	permission: {
		onRequest: (cb: (req: PermissionRequest) => void): UnsubscribeFn => {
			const handler = (
				_evt: Electron.IpcRendererEvent,
				req: PermissionRequest,
			) => cb(req);
			ipcRenderer.on(IPC_CHANNELS.PERMISSION_REQUEST, handler);
			return () =>
				ipcRenderer.removeListener(IPC_CHANNELS.PERMISSION_REQUEST, handler);
		},

		respond: (
			requestId: string,
			decision: "allow" | "deny" | "allow_always",
		): void => {
			ipcRenderer.send(IPC_CHANNELS.PERMISSION_RESPOND, {
				requestId,
				decision,
			});
		},
	},
};

contextBridge.exposeInMainWorld("bubbles", api);

export type BubblesPreloadAPI = typeof api;
