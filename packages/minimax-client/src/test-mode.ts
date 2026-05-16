/**
 * Deterministic test-mode stubs for MiniMax chat and TTS.
 * Activated when BUBBLES_TEST_MODE=1 is set in the environment.
 */

export interface FakeChatResponse {
	text: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export interface FakeTtsResponse {
	/** Empty MP3 frame (silent, 1 second, 48kHz, mono). */
	buffer: Buffer;
}

const FAKE_MP3_FRAME = Buffer.from([
	0xff, 0xfb, 0x90, 0x64, 0x00, 0x0f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x00,
]);

/** Deterministic canned responses for test mode. */
const CHAT_RESPONSES: Record<
	string,
	(_text: string, agentId?: string) => FakeChatResponse
> = {
	default: (text, agentId) => ({
		text: `[TEST MODE] You said: "${text}". Agent: ${agentId ?? "bubbles"}.`,
		usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
	}),
	hi: () => ({
		text: "Hello! I'm Bubbles, your desktop AI assistant. How can I help you today?",
		usage: { promptTokens: 5, completionTokens: 15, totalTokens: 20 },
	}),
	ping: () => ({
		text: "pong",
		usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
	}),
	"2+2": () => ({
		text: "2 + 2 = 4",
		usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
	}),
	file: (_text, agentId) => {
		if (agentId === "coda") {
			return {
				text: "I'll create that file for you.",
				usage: { promptTokens: 8, completionTokens: 8, totalTokens: 16 },
			};
		}
		return {
			text: "I can read files but not write them. Switch to Coda for file operations.",
			usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
		};
	},
};

function matchResponse(text: string, agentId?: string): FakeChatResponse {
	const lower = text.toLowerCase().trim();
	if (lower.includes("hello") || lower.includes("hi ") || lower === "hi")
		return CHAT_RESPONSES.hi(text, agentId);
	if (lower === "ping") return CHAT_RESPONSES.ping(text, agentId);
	if (lower.includes("2+2") || lower.includes("what's 2+2"))
		return CHAT_RESPONSES["2+2"](text, agentId);
	if (
		lower.includes("file") ||
		lower.includes("write") ||
		lower.includes("create")
	)
		return CHAT_RESPONSES.file(text, agentId);
	return CHAT_RESPONSES.default(text, agentId);
}

export function isTestMode(): boolean {
	return process.env.BUBBLES_TEST_MODE === "1";
}

export async function* fakeStreamChat(opts: {
	messages: Array<{ role: string; content: string }>;
	turnId: string;
}): AsyncGenerator<{
	text: string;
	finishReason?: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}> {
	const userMsg = [...opts.messages]
		.reverse()
		.find((m: { role: string }) => m.role === "user");
	const agentMsg = opts.messages.find(
		(m: { role: string }) => m.role === "system",
	);
	const agentId = agentMsg?.content?.toLowerCase().includes("coda")
		? "coda"
		: agentMsg?.content?.toLowerCase().includes("sage")
			? "sage"
			: "bubbles";
	const response = matchResponse(userMsg?.content ?? "", agentId);

	// Stream word-by-word for realism
	const words = response.text.split(" ");
	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		yield { text: i === 0 ? word : ` ${word}` };
		// Tiny delay to simulate streaming without slowing tests
		await new Promise((r) => setTimeout(r, 2));
	}

	yield {
		text: "",
		finishReason: "stop",
		usage: response.usage,
	};
}

export async function fakeSynthesize(_opts: {
	text: string;
	turnId: string;
}): Promise<Buffer> {
	return FAKE_MP3_FRAME;
}
