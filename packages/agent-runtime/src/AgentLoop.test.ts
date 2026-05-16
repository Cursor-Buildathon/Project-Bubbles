import { describe, expect, it } from "vitest";
import { buildChatMessagesFromRows } from "./AgentLoop";

describe("buildChatMessagesFromRows", () => {
	it("includes prior conversation turns before the current user message", () => {
		expect(
			buildChatMessagesFromRows(
				[
					{
						role: "user",
						content: "Remember this: my favourite colour is blue",
					},
					{
						role: "assistant",
						content: "Got it, your favourite colour is blue.",
					},
					{
						role: "user",
						content: "What is my favourite colour?",
					},
				],
				"system prompt",
				"fallback",
			).map((message) => message.content),
		).toEqual([
			"system prompt",
			"Remember this: my favourite colour is blue",
			"Got it, your favourite colour is blue.",
			"What is my favourite colour?",
		]);
	});
});
