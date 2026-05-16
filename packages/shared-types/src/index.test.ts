import { describe, expect, it } from "vitest";
import { hello, versionedChannelSchema } from "./index";

describe("@bubbles/shared-types", () => {
	it("hello", () => {
		expect(hello()).toBe("hello");
	});

	it("accepts versioned channel", () => {
		expect(versionedChannelSchema.safeParse("v1:agent:run").success).toBe(true);
	});

	it("rejects non-versioned channel", () => {
		expect(versionedChannelSchema.safeParse("agent:run").success).toBe(false);
	});
});
