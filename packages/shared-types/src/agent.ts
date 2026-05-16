import { z } from "zod";
import { MoodSchema } from "./ipc";

export const MemoryScopeSchema = z.enum(["agent", "project", "global"]);
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

export const AgentModelSchema = z.enum([
	"MiniMax-Text-01",
	"MiniMax-Text-01-Lightning",
]);
export type AgentModel = z.infer<typeof AgentModelSchema>;

export const PersonaSchema = z.object({
	tone: z.string(),
	style: z.string(),
	emoji: z.string().optional(),
});

// Filesystem config.json schema for ~/.bubbles/agents/<id>/config.json
export const AgentConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	tint: z.number().int().default(0xffffff),
	atlas: z.string().default("sprites/spritesheet.png"),
	defaultMood: MoodSchema.default("idle"),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AgentSchema = z.object({
	id: z.string(),
	name: z.string(),
	persona: PersonaSchema,
	skinId: z.string(),
	voiceId: z.string(),
	systemPrompt: z.string(),
	toolWhitelist: z.array(z.string()),
	rules: z.array(z.string()),
	memoryScope: MemoryScopeSchema,
	model: AgentModelSchema,
	createdAt: z.number(),
});
export type Agent = z.infer<typeof AgentSchema>;
