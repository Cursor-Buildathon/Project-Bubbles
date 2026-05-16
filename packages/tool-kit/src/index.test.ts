import { describe, expect, it } from "vitest";
import { hello } from "./index";

describe("@bubbles/tool-kit", () => {
	it("hello", () => {
		expect(hello()).toBe("hello");
	});
});
