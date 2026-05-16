import { z } from "zod";

// Avatar mood enum — used by MoodController and IPC
export const MoodSchema = z.enum([
	"idle",
	"listening",
	"thinking",
	"talking",
	"greeting",
	"celebrating",
	"error",
]);
export type Mood = z.infer<typeof MoodSchema>;

// v1:avatar:setMood — main pushes to avatar window
export const AvatarSetMoodPayloadSchema = z.object({
	mood: MoodSchema,
});
export type AvatarSetMoodPayload = z.infer<typeof AvatarSetMoodPayloadSchema>;

// v1:avatar:setIgnoreMouse — renderer tells main to toggle click-through
export const AvatarSetIgnoreMousePayloadSchema = z.object({
	ignore: z.boolean(),
});
export type AvatarSetIgnoreMousePayload = z.infer<
	typeof AvatarSetIgnoreMousePayloadSchema
>;

// v1:avatar:setSkin — chat window asks main to relay active agent to avatar
export const AvatarSetSkinPayloadSchema = z.object({
	agentId: z.string(),
});
export type AvatarSetSkinPayload = z.infer<typeof AvatarSetSkinPayloadSchema>;

// v1:agent:run — renderer invokes, main handles
export const AgentRunRequestSchema = z.object({
	turnId: z.string().uuid().optional(),
	agentId: z.string().default("bubbles"),
	text: z.string().min(1),
	conversationId: z.string().uuid().optional(),
});
export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;

export const AgentRunResponseSchema = z.object({
	turnId: z.string().uuid(),
	conversationId: z.string().uuid(),
	status: z.enum(["done", "error"]),
	error: z.string().optional(),
});
export type AgentRunResponse = z.infer<typeof AgentRunResponseSchema>;

// v1:agent:stream:{turnId} — main pushes to renderer
export const AgentStreamChunkSchema = z.object({
	delta: z.string(),
	done: z.boolean(),
	turnId: z.string().uuid(),
	toolCall: z
		.object({ name: z.string(), args: z.record(z.unknown()) })
		.optional(),
	toolResult: z.object({ name: z.string(), result: z.string() }).optional(),
});
export type AgentStreamChunk = z.infer<typeof AgentStreamChunkSchema>;

// v1:memory:query — renderer invokes, main handles
export const MemoryQueryRequestSchema = z.object({
	conversationId: z.string().uuid().optional(),
	agentId: z.string().optional(),
	limit: z.number().int().positive().default(20),
});
export type MemoryQueryRequest = z.infer<typeof MemoryQueryRequestSchema>;

export const MemoryQueryResponseSchema = z.object({
	messages: z.array(
		z.object({
			id: z.string(),
			role: z.enum(["user", "assistant", "system"]),
			content: z.string(),
			createdAt: z.number(),
		}),
	),
});
export type MemoryQueryResponse = z.infer<typeof MemoryQueryResponseSchema>;

// v1:audio:play — main pushes to renderer (ArrayBuffer serialised as number[])
export const AudioPlayPayloadSchema = z.object({
	data: z.array(z.number()),
	mimeType: z.literal("audio/mpeg").default("audio/mpeg"),
});
export type AudioPlayPayload = z.infer<typeof AudioPlayPayloadSchema>;

// v1:audio:amplitude — renderer pushes to main (lip-sync)
export const AudioAmplitudePayloadSchema = z.object({
	rms: z.number().min(0).max(1),
	turnId: z.string().uuid(),
});
export type AudioAmplitudePayload = z.infer<typeof AudioAmplitudePayloadSchema>;

// v1:debug:setApiKey — renderer invokes, main stores in safeStorage
export const DebugSetApiKeyRequestSchema = z.object({
	key: z.string().min(1),
});
export type DebugSetApiKeyRequest = z.infer<typeof DebugSetApiKeyRequestSchema>;

export const DebugSetApiKeyResponseSchema = z.object({
	ok: z.boolean(),
});
export type DebugSetApiKeyResponse = z.infer<
	typeof DebugSetApiKeyResponseSchema
>;

// v1:debug:hasApiKey — renderer invokes, main reports stored in-memory key state
export const DebugHasApiKeyResponseSchema = z.object({
	hasKey: z.boolean(),
});
export type DebugHasApiKeyResponse = z.infer<
	typeof DebugHasApiKeyResponseSchema
>;

// v1:debug:needsOnboarding — renderer invokes
export const NeedsOnboardingResponseSchema = z.object({
	needsOnboarding: z.boolean(),
	reason: z.enum(["no_api_key", "no_project_root"]).optional(),
});
export type NeedsOnboardingResponse = z.infer<
	typeof NeedsOnboardingResponseSchema
>;

// v1:app:pickFolder — renderer invokes, main shows dialog
export const PickFolderResponseSchema = z.object({
	canceled: z.boolean(),
	filePaths: z.array(z.string()),
});
export type PickFolderResponse = z.infer<typeof PickFolderResponseSchema>;

// v1:app:closeChat — renderer sends, main hides chat panel
// no payload schema needed

// v1:file:peek — renderer invokes, main reads file for diff preview
export const FilePeekRequestSchema = z.object({
	path: z.string(),
});
export type FilePeekRequest = z.infer<typeof FilePeekRequestSchema>;

export const FilePeekResponseSchema = z.object({
	exists: z.boolean(),
	content: z.string(),
});
export type FilePeekResponse = z.infer<typeof FilePeekResponseSchema>;

// v1:settings:getSpendSummary — renderer invokes
export const SpendSummaryRequestSchema = z.object({
	days: z.number().int().positive().default(7),
});
export type SpendSummaryRequest = z.infer<typeof SpendSummaryRequestSchema>;

export const SpendSummaryResponseSchema = z.object({
	days: z.array(
		z.object({
			date: z.string(),
			totalCostUsd: z.number(),
			totalInputTokens: z.number(),
			totalOutputTokens: z.number(),
		}),
	),
	capUsd: z.number(),
});
export type SpendSummaryResponse = z.infer<typeof SpendSummaryResponseSchema>;

// v1:settings:setCostCap — renderer invokes
export const SetCostCapRequestSchema = z.object({
	capUsd: z.number().positive(),
});
export type SetCostCapRequest = z.infer<typeof SetCostCapRequestSchema>;

// v1:permission:request — main pushes to renderer (requires user decision)
export const PermissionRequestSchema = z.object({
	requestId: z.string().uuid(),
	turnId: z.string().uuid(),
	tool: z.string(),
	args: z.record(z.unknown()),
	description: z.string(),
});
export type PermissionRequest = z.infer<typeof PermissionRequestSchema>;

// v1:permission:respond — renderer sends to main
export const PermissionResponseSchema = z.object({
	requestId: z.string().uuid(),
	decision: z.enum(["allow", "deny", "allow_always"]),
});
export type PermissionResponse = z.infer<typeof PermissionResponseSchema>;

// v1:agent:list — renderer invokes, main returns agent registry
export const AgentListResponseSchema = z.object({
	agents: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			tint: z.number().int(),
		}),
	),
});
export type AgentListResponse = z.infer<typeof AgentListResponseSchema>;

/** All versioned IPC channel names used by Bubbles. */
export const IPC_CHANNELS = {
	AGENT_RUN: "v1:agent:run",
	AGENT_STREAM: (turnId: string) => `v1:agent:stream:${turnId}`,
	AGENT_LIST: "v1:agent:list",
	MEMORY_QUERY: "v1:memory:query",
	AUDIO_PLAY: "v1:audio:play",
	AUDIO_AMPLITUDE: "v1:audio:amplitude",
	AUDIO_AMPLITUDE_BROADCAST: "v1:audio:amplitudeBroadcast",
	AVATAR_SET_MOOD: "v1:avatar:setMood",
	AVATAR_SET_IGNORE_MOUSE: "v1:avatar:setIgnoreMouse",
	AVATAR_SET_SKIN: "v1:avatar:setSkin",
	AVATAR_TOGGLE_CHAT: "v1:avatar:toggleChat",
	AVATAR_DRAG_START: "v1:avatar:dragStart",
	AVATAR_DRAG_MOVE: "v1:avatar:dragMove",
	AVATAR_DRAG_END: "v1:avatar:dragEnd",
	AGENT_LAST_CONVERSATION: "v1:agent:lastConversation",
	DEBUG_SET_API_KEY: "v1:debug:setApiKey",
	DEBUG_HAS_API_KEY: "v1:debug:hasApiKey",
	DEBUG_NEEDS_ONBOARDING: "v1:debug:needsOnboarding",
	APP_PICK_FOLDER: "v1:app:pickFolder",
	APP_CLOSE_CHAT: "v1:app:closeChat",
	FILE_PEEK: "v1:file:peek",
	SETTINGS_GET_SPEND: "v1:settings:getSpendSummary",
	SETTINGS_SET_CAP: "v1:settings:setCostCap",
	PERMISSION_REQUEST: "v1:permission:request",
	PERMISSION_RESPOND: "v1:permission:respond",
} as const;
