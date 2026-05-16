import { describe, expect, it } from "vitest";
import { hello } from "./index";

describe("@bubbles/memory-core", () => {
	it("hello", () => {
		expect(hello()).toBe("hello");
	});
});
