import { describe, expect, it } from "vitest";
import { title } from "./strings";

describe("@bubbles/renderer strings", () => {
	it("title", () => {
		expect(title()).toBe("Bubbles");
	});
});
