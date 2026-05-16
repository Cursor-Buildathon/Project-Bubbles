import { describe, expect, it } from "vitest";
import { hello } from "./index";

describe("@bubbles/cost-meter", () => {
	it("hello", () => {
		expect(hello()).toBe("hello");
	});
});
