import { z } from "zod";

export const MessageRoleSchema = z.enum([
	"user",
	"assistant",
	"system",
	"tool",
]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const ToolCallSchema = z.object({
	id: z.string(),
	name: z.string(),
	arguments: z.record(z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const MessageSchema = z.object({
	id: z.string(),
	conversationId: z.string(),
	role: MessageRoleSchema,
	content: z.string(),
	toolCalls: z.array(ToolCallSchema).optional(),
	createdAt: z.number(),
});
export type Message = z.infer<typeof MessageSchema>;

/** Chat-API format consumed by MiniMax (role + content only). */
export const ChatMessageSchema = z.object({
	role: MessageRoleSchema,
	content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
