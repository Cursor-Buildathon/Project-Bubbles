import { describe, expect, it } from "vitest";
import {
	AgentConfigSchema,
	AgentRunRequestSchema,
	AgentRunResponseSchema,
	AgentSchema,
	AgentStreamChunkSchema,
	AudioAmplitudePayloadSchema,
	AudioPlayPayloadSchema,
	AvatarSetMoodPayloadSchema,
	ConversationSchema,
	CostEventSchema,
	DebugHasApiKeyResponseSchema,
	DebugSetApiKeyRequestSchema,
	IPC_CHANNELS,
	MemoryQueryRequestSchema,
	MemoryQueryResponseSchema,
	MemorySchema,
	MessageSchema,
	MoodSchema,
	TimelineEventSchema,
	versionedChannelSchema,
} from "./index";

describe("versionedChannelSchema", () => {
	it("accepts v1: prefix", () => {
		expect(versionedChannelSchema.safeParse("v1:agent:run").success).toBe(true);
	});
	it("rejects missing prefix", () => {
		expect(versionedChannelSchema.safeParse("agent:run").success).toBe(false);
	});
});

describe("IPC_CHANNELS", () => {
	it("AGENT_RUN is versioned", () => {
		expect(
			versionedChannelSchema.safeParse(IPC_CHANNELS.AGENT_RUN).success,
		).toBe(true);
	});
	it("AGENT_STREAM generates versioned channel", () => {
		const id = "00000000-0000-0000-0000-000000000001";
		expect(IPC_CHANNELS.AGENT_STREAM(id)).toBe(`v1:agent:stream:${id}`);
	});
	it("all new Phase 3 channels are versioned", () => {
		const channels = [
			IPC_CHANNELS.AGENT_LIST,
			IPC_CHANNELS.AVATAR_SET_MOOD,
			IPC_CHANNELS.AVATAR_SET_IGNORE_MOUSE,
			IPC_CHANNELS.AVATAR_SET_SKIN,
			IPC_CHANNELS.AUDIO_AMPLITUDE_BROADCAST,
		];
		for (const ch of channels) {
			expect(
				versionedChannelSchema.safeParse(ch).success,
				`${ch} should be versioned`,
			).toBe(true);
		}
	});
});

describe("MoodSchema", () => {
	it("accepts all valid moods", () => {
		const moods = [
			"idle",
			"listening",
			"thinking",
			"talking",
			"greeting",
			"celebrating",
			"error",
		];
		for (const mood of moods) {
			expect(
				MoodSchema.safeParse(mood).success,
				`mood '${mood}' should be valid`,
			).toBe(true);
		}
	});
	it("rejects unknown mood", () => {
		expect(MoodSchema.safeParse("dancing").success).toBe(false);
	});
});

describe("AvatarSetMoodPayloadSchema", () => {
	it("accepts valid mood payload", () => {
		expect(AvatarSetMoodPayloadSchema.safeParse({ mood: "idle" }).success).toBe(
			true,
		);
	});
	it("rejects invalid mood", () => {
		expect(
			AvatarSetMoodPayloadSchema.safeParse({ mood: "flying" }).success,
		).toBe(false);
	});
});

describe("AgentConfigSchema", () => {
	it("parses a complete config", () => {
		const r = AgentConfigSchema.safeParse({
			id: "bubbles",
			name: "Bubbles",
			tint: 0xffffff,
			atlas: "sprites/spritesheet.png",
			defaultMood: "idle",
		});
		expect(r.success).toBe(true);
	});
	it("applies tint default", () => {
		const r = AgentConfigSchema.parse({ id: "x", name: "X" });
		expect(r.tint).toBe(0xffffff);
	});
	it("applies defaultMood default", () => {
		const r = AgentConfigSchema.parse({ id: "x", name: "X" });
		expect(r.defaultMood).toBe("idle");
	});
});

describe("DebugHasApiKeyResponseSchema", () => {
	it("accepts key status responses", () => {
		expect(
			DebugHasApiKeyResponseSchema.safeParse({ hasKey: true }).success,
		).toBe(true);
	});
});

describe("AgentRunRequestSchema", () => {
	it("accepts valid request", () => {
		const r = AgentRunRequestSchema.safeParse({ text: "hello" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.agentId).toBe("bubbles");
	});
	it("rejects empty text", () => {
		expect(AgentRunRequestSchema.safeParse({ text: "" }).success).toBe(false);
	});
});

describe("AgentRunResponseSchema", () => {
	it("accepts done status", () => {
		const r = AgentRunResponseSchema.safeParse({
			turnId: "00000000-0000-0000-0000-000000000001",
			conversationId: "00000000-0000-0000-0000-000000000002",
			status: "done",
		});
		expect(r.success).toBe(true);
	});
	it("rejects invalid status", () => {
		expect(
			AgentRunResponseSchema.safeParse({
				turnId: "bad",
				conversationId: "bad",
				status: "pending",
			}).success,
		).toBe(false);
	});
});

describe("AgentStreamChunkSchema", () => {
	it("accepts valid chunk", () => {
		const r = AgentStreamChunkSchema.safeParse({
			delta: "hello",
			done: false,
			turnId: "00000000-0000-0000-0000-000000000001",
		});
		expect(r.success).toBe(true);
	});
});

describe("MemoryQueryRequestSchema", () => {
	it("applies default limit", () => {
		const r = MemoryQueryRequestSchema.parse({});
		expect(r.limit).toBe(20);
	});
});

describe("MemoryQueryResponseSchema", () => {
	it("accepts empty messages", () => {
		expect(MemoryQueryResponseSchema.safeParse({ messages: [] }).success).toBe(
			true,
		);
	});
});

describe("AudioPlayPayloadSchema", () => {
	it("accepts payload", () => {
		expect(AudioPlayPayloadSchema.safeParse({ data: [1, 2, 3] }).success).toBe(
			true,
		);
	});
});

describe("AudioAmplitudePayloadSchema", () => {
	it("rejects rms > 1", () => {
		expect(
			AudioAmplitudePayloadSchema.safeParse({
				rms: 1.5,
				turnId: "00000000-0000-0000-0000-000000000001",
			}).success,
		).toBe(false);
	});
});

describe("DebugSetApiKeyRequestSchema", () => {
	it("rejects empty key", () => {
		expect(DebugSetApiKeyRequestSchema.safeParse({ key: "" }).success).toBe(
			false,
		);
	});
});

describe("AgentSchema", () => {
	const valid = {
		id: "bubbles",
		name: "Bubbles",
		persona: { tone: "friendly", style: "casual" },
		skinId: "bubbles-base",
		voiceId: "v1",
		systemPrompt: "You are Bubbles.",
		toolWhitelist: [],
		rules: [],
		memoryScope: "global",
		model: "MiniMax-Text-01",
		createdAt: Date.now(),
	};
	it("accepts valid agent", () => {
		expect(AgentSchema.safeParse(valid).success).toBe(true);
	});
	it("rejects invalid model", () => {
		expect(AgentSchema.safeParse({ ...valid, model: "gpt-4" }).success).toBe(
			false,
		);
	});
});

describe("MessageSchema", () => {
	it("accepts user message", () => {
		const r = MessageSchema.safeParse({
			id: "m1",
			conversationId: "c1",
			role: "user",
			content: "hello",
			createdAt: Date.now(),
		});
		expect(r.success).toBe(true);
	});
	it("rejects invalid role", () => {
		expect(
			MessageSchema.safeParse({
				id: "m1",
				conversationId: "c1",
				role: "bot",
				content: "hi",
				createdAt: 0,
			}).success,
		).toBe(false);
	});
});

describe("ConversationSchema", () => {
	it("accepts nullable fields", () => {
		const r = ConversationSchema.safeParse({
			id: "c1",
			agentId: "bubbles",
			projectId: null,
			startedAt: Date.now(),
			summary: null,
		});
		expect(r.success).toBe(true);
	});
});

describe("MemorySchema", () => {
	it("accepts valid memory", () => {
		const r = MemorySchema.safeParse({
			id: "mem1",
			kind: "conversation",
			scope: "global",
			agentId: null,
			projectId: null,
			content: "fact",
			sourceMessageId: null,
			createdAt: Date.now(),
		});
		expect(r.success).toBe(true);
	});
});

describe("TimelineEventSchema", () => {
	it("accepts event", () => {
		expect(
			TimelineEventSchema.safeParse({
				id: "e1",
				kind: "message",
				refId: null,
				summary: "user said hello",
				occurredAt: Date.now(),
			}).success,
		).toBe(true);
	});
});

describe("CostEventSchema", () => {
	it("accepts chat cost", () => {
		const r = CostEventSchema.safeParse({
			id: "ce1",
			kind: "chat",
			model: "MiniMax-Text-01",
			inputTokens: 10,
			outputTokens: 50,
			characters: 0,
			costUsd: 0.001,
			turnId: null,
			createdAt: Date.now(),
		});
		expect(r.success).toBe(true);
	});
});
