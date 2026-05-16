import { describe, expect, it } from "vitest";
import { chatCompletion, enhanceImagePrompt, generateImage } from "./index";

describe("@bubbles/minimax-client", () => {
	it("exports chatCompletion", () => {
		expect(typeof chatCompletion).toBe("function");
	});

	it("exports enhanceImagePrompt", () => {
		expect(typeof enhanceImagePrompt).toBe("function");
	});

	it("exports generateImage", () => {
		expect(typeof generateImage).toBe("function");
	});
});
