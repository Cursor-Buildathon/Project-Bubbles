import { describe, expect, it } from "vitest";
import { fakeStreamChat, fakeSynthesize, isTestMode } from "./test-mode";

describe("test-mode", () => {
	describe("isTestMode", () => {
		it("returns false when env is not set", () => {
			const original = process.env.BUBBLES_TEST_MODE;
			delete process.env.BUBBLES_TEST_MODE;
			expect(isTestMode()).toBe(false);
			process.env.BUBBLES_TEST_MODE = original;
		});

		it("returns true when env is 1", () => {
			const original = process.env.BUBBLES_TEST_MODE;
			process.env.BUBBLES_TEST_MODE = "1";
			expect(isTestMode()).toBe(true);
			process.env.BUBBLES_TEST_MODE = original;
		});
	});

	describe("fakeStreamChat", () => {
		it("streams a greeting response for 'hi'", async () => {
			const chunks: string[] = [];
			for await (const chunk of fakeStreamChat({
				messages: [{ role: "user", content: "hi" }],
				turnId: "test-1",
			})) {
				chunks.push(chunk.text);
				if (chunk.finishReason) {
					expect(chunk.usage).toBeDefined();
				}
			}
			const fullText = chunks.join("");
			expect(fullText).toContain("Bubbles");
		});

		it("streams 'pong' for ping", async () => {
			const chunks: string[] = [];
			for await (const chunk of fakeStreamChat({
				messages: [{ role: "user", content: "ping" }],
				turnId: "test-2",
			})) {
				chunks.push(chunk.text);
			}
			expect(chunks.join("")).toBe("pong");
		});

		it("returns default response for unknown input", async () => {
			const chunks: string[] = [];
			for await (const chunk of fakeStreamChat({
				messages: [{ role: "user", content: "something random" }],
				turnId: "test-3",
			})) {
				chunks.push(chunk.text);
			}
			expect(chunks.join("")).toContain("TEST MODE");
		});
	});

	describe("fakeSynthesize", () => {
		it("returns a non-empty buffer", async () => {
			const buf = await fakeSynthesize({ text: "hello", turnId: "test-1" });
			expect(buf.length).toBeGreaterThan(0);
			expect(buf[0]).toBe(0xff);
			expect(buf[1]).toBe(0xfb);
		});
	});
});
