import { z } from "zod";

export const ConversationSchema = z.object({
	id: z.string(),
	agentId: z.string(),
	projectId: z.string().nullable(),
	startedAt: z.number(),
	summary: z.string().nullable(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MemoryKindSchema = z.enum([
	"agent",
	"project",
	"conversation",
	"file",
	"relationship",
]);
export type MemoryKind = z.infer<typeof MemoryKindSchema>;

export const MemorySchema = z.object({
	id: z.string(),
	kind: MemoryKindSchema,
	scope: z.enum(["agent", "project", "global"]),
	agentId: z.string().nullable(),
	projectId: z.string().nullable(),
	content: z.string(),
	sourceMessageId: z.string().nullable(),
	createdAt: z.number(),
});
export type Memory = z.infer<typeof MemorySchema>;

export const TimelineEventSchema = z.object({
	id: z.string(),
	kind: z.string(),
	refId: z.string().nullable(),
	summary: z.string(),
	occurredAt: z.number(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const CostEventSchema = z.object({
	id: z.string(),
	kind: z.enum(["chat", "tts", "tts_hd", "embedding", "image"]),
	model: z.string(),
	inputTokens: z.number().int().default(0),
	outputTokens: z.number().int().default(0),
	characters: z.number().int().default(0),
	costUsd: z.number().default(0),
	turnId: z.string().nullable(),
	createdAt: z.number(),
});
export type CostEvent = z.infer<typeof CostEventSchema>;
