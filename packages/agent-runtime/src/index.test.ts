import { describe, expect, it } from "vitest";
import { hello } from "./index";

describe("@bubbles/agent-runtime", () => {
	it("hello", () => {
		expect(hello()).toBe("hello");
	});
});
