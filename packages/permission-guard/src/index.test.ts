import { describe, expect, it } from "vitest";
import { hello } from "./index";

describe("@bubbles/permission-guard", () => {
	it("hello", () => {
		expect(hello()).toBe("hello");
	});
});
