import { describe, expect, it } from "vitest";
import { hello } from "./index";

describe("@bubbles/minimax-client", () => {
	it("hello", () => {
		expect(hello()).toBe("hello");
	});
});
