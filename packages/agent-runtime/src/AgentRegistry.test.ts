import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAgent, listAgents } from "./AgentRegistry";

const testBase = join(tmpdir(), `bubbles-test-${Date.now()}`);

// Patch HOME so AgentRegistry reads our temp dir
beforeEach(() => {
	vi.stubEnv("USERPROFILE", testBase);
	vi.stubEnv("HOME", testBase);
	mkdirSync(join(testBase, ".bubbles", "agents"), { recursive: true });
});

afterEach(() => {
	vi.unstubAllEnvs();
	if (existsSync(testBase)) rmSync(testBase, { recursive: true, force: true });
});

function writeAgent(id: string, config: object): void {
	const dir = join(testBase, ".bubbles", "agents", id);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "config.json"), JSON.stringify(config));
}

describe("listAgents", () => {
	it("returns empty array when agents dir is missing agents", () => {
		expect(listAgents()).toEqual([]);
	});

	it("parses a valid config.json", () => {
		writeAgent("bubbles", {
			id: "bubbles",
			name: "Bubbles",
			tint: 0xffffff,
			atlas: "sprites/spritesheet.png",
			defaultMood: "idle",
		});
		const result = listAgents();
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("bubbles");
		expect(result[0].name).toBe("Bubbles");
	});

	it("skips directories without config.json", () => {
		mkdirSync(join(testBase, ".bubbles", "agents", "ghost"), {
			recursive: true,
		});
		expect(listAgents()).toEqual([]);
	});

	it("skips malformed config.json silently", () => {
		const dir = join(testBase, ".bubbles", "agents", "broken");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "config.json"), "{ not valid json }");
		expect(listAgents()).toEqual([]);
	});

	it("returns multiple agents sorted by directory order", () => {
		writeAgent("bubbles", {
			id: "bubbles",
			name: "Bubbles",
			tint: 0xffffff,
			atlas: "sprites/spritesheet.png",
			defaultMood: "idle",
		});
		writeAgent("coda", {
			id: "coda",
			name: "Coda",
			tint: 0x6fb3ff,
			atlas: "sprites/spritesheet.png",
			defaultMood: "idle",
		});
		const result = listAgents();
		expect(result).toHaveLength(2);
	});
});

describe("getAgent", () => {
	it("returns null when agent not found", () => {
		expect(getAgent("nonexistent")).toBeNull();
	});

	it("returns the matching agent", () => {
		writeAgent("sage", {
			id: "sage",
			name: "Sage",
			tint: 0x9cd17b,
			atlas: "sprites/spritesheet.png",
			defaultMood: "idle",
		});
		const agent = getAgent("sage");
		expect(agent).not.toBeNull();
		expect(agent?.name).toBe("Sage");
	});
});
