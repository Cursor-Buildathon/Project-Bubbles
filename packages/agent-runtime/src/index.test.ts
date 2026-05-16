import { describe, expect, it } from "vitest";
import { getAgent, listAgents } from "./index";

describe("@bubbles/agent-runtime exports", () => {
	it("listAgents returns an array", () => {
		// No agents dir in test env — should return empty array without crashing
		expect(Array.isArray(listAgents())).toBe(true);
	});

	it("getAgent returns null for missing agent", () => {
		expect(getAgent("nonexistent")).toBeNull();
	});
});
