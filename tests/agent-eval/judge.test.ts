import { describe, expect, it } from "vitest";
import { runCase, runEvalHarness } from "./judge";

describe("judge", () => {
	describe("runCase", () => {
		it("scores a response that meets all rubric criteria highly", async () => {
			const result = await runCase(
				{
					id: "test-1",
					agentId: "bubbles",
					prompt: "Say hello",
					rubric: ["Greets warmly", "Mentions name Bubbles"],
					minScore: 4,
				},
				async () => "Hello! I am Bubbles, your friendly assistant.",
			);
			expect(result.score).toBeGreaterThanOrEqual(4);
			expect(result.passed).toBe(true);
		});

		it("fails a response that misses rubric criteria", async () => {
			const result = await runCase(
				{
					id: "test-2",
					agentId: "bubbles",
					prompt: "Say hello",
					rubric: [
						"Greets warmly",
						"Mentions name Bubbles",
						"Concise under 2 sentences",
					],
					minScore: 4,
				},
				async () => "Goodbye and have a terrible day.",
			);
			expect(result.score).toBeLessThan(4);
			expect(result.passed).toBe(false);
		});
	});

	describe("runEvalHarness", () => {
		it("returns empty result for empty dataset", async () => {
			const result = await runEvalHarness(
				async () => "test",
				"/dev/null/nonexistent-dataset.jsonl",
			);
			expect(result.total).toBe(0);
		});

		it("computes average and pass/fail counts", async () => {
			const result = await runEvalHarness(
				async () => "Hello I am Bubbles",
				undefined,
			);
			// With the real dataset, we should get meaningful numbers
			expect(result.total).toBeGreaterThanOrEqual(0);
			if (result.total > 0) {
				expect(result.average).toBeGreaterThanOrEqual(1);
				expect(result.average).toBeLessThanOrEqual(5);
				expect(result.passed + result.failed).toBe(result.total);
			}
		});
	});
});
