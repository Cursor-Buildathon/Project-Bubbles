import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearApiKey, getApiKey, setApiKey } from "./auth";
import { withBackoff } from "./backoff";
import { streamChat } from "./chat";
import { synthesize } from "./tts";

// ── auth ──────────────────────────────────────────────────────────────────────

describe("auth", () => {
	afterEach(() => clearApiKey());

	it("throws when key not set", () => {
		expect(() => getApiKey()).toThrow("MiniMax API key not set");
	});

	it("returns key after setApiKey", () => {
		setApiKey("test-key-123");
		expect(getApiKey()).toBe("test-key-123");
	});

	it("clearApiKey removes the key", () => {
		setApiKey("abc");
		clearApiKey();
		expect(() => getApiKey()).toThrow();
	});
});

// ── backoff ───────────────────────────────────────────────────────────────────

describe("withBackoff", () => {
	it("returns immediately on success", async () => {
		const result = await withBackoff(async () => "ok");
		expect(result).toBe("ok");
	});

	it("retries on 429 and succeeds on second attempt", async () => {
		let calls = 0;
		const result = await withBackoff(async () => {
			calls++;
			if (calls < 2) {
				const err = Object.assign(new Error("rate limit"), { status: 429 });
				throw err;
			}
			return "done";
		});
		expect(result).toBe("done");
		expect(calls).toBe(2);
	});

	it("does not retry on 400", async () => {
		let calls = 0;
		await expect(
			withBackoff(async () => {
				calls++;
				throw Object.assign(new Error("bad request"), { status: 400 });
			}),
		).rejects.toThrow("bad request");
		expect(calls).toBe(1);
	});

	it("exhausts max attempts on repeated 500", async () => {
		let calls = 0;
		await expect(
			withBackoff(async () => {
				calls++;
				throw Object.assign(new Error("server error"), { status: 500 });
			}),
		).rejects.toThrow("server error");
		expect(calls).toBe(3);
	});
});

// ── chat (mocked fetch) ───────────────────────────────────────────────────────

function makeSseStream(lines: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const line of lines) {
				controller.enqueue(encoder.encode(`${line}\n`));
			}
			controller.close();
		},
	});
}

describe("streamChat", () => {
	beforeEach(() => setApiKey("mock-key"));
	afterEach(() => {
		clearApiKey();
		vi.unstubAllGlobals();
	});

	it("yields text deltas from SSE stream", async () => {
		const sseLines = [
			'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
			'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}',
			"data: [DONE]",
		];
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				body: makeSseStream(sseLines),
			}),
		);

		const chunks: string[] = [];
		for await (const chunk of streamChat({
			messages: [{ role: "user", content: "hi" }],
			turnId: "t1",
		})) {
			chunks.push(chunk.text);
		}
		expect(chunks.filter((c) => c)).toEqual(["Hello", " world"]);
	});

	it("throws on missing API key", async () => {
		clearApiKey();
		const gen = streamChat({
			messages: [{ role: "user", content: "hi" }],
			turnId: "t1",
		});
		await expect(gen.next()).rejects.toThrow("API key not set");
	});

	it("throws on non-ok response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				body: makeSseStream([]),
			}),
		);
		const gen = streamChat({
			messages: [{ role: "user", content: "hi" }],
			turnId: "t1",
		});
		await expect(gen.next()).rejects.toThrow("MiniMax chat error: 401");
	});
});

// ── TTS (mocked fetch) ────────────────────────────────────────────────────────

describe("synthesize", () => {
	beforeEach(() => setApiKey("mock-key"));
	afterEach(() => {
		clearApiKey();
		vi.unstubAllGlobals();
	});

	it("returns a Buffer", async () => {
		const fakeAudio = new Uint8Array([0xff, 0xfb, 0x90]);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: async () => fakeAudio.buffer,
			}),
		);

		const buf = await synthesize({ text: "Hello", turnId: "t1" });
		expect(Buffer.isBuffer(buf)).toBe(true);
		expect(buf.length).toBe(3);
	});

	it("throws on non-ok TTS response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
				statusText: "Forbidden",
			}),
		);
		await expect(synthesize({ text: "hi", turnId: "t1" })).rejects.toThrow(
			"MiniMax TTS error: 403",
		);
	});
});
