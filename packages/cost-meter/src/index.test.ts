import type { Db } from "@bubbles/memory-core";
import { initDb } from "@bubbles/memory-core";
import { beforeEach, describe, expect, it } from "vitest";
import { getDailySummary, recordCostEvent } from "./index";

let db: Db;

beforeEach(() => {
	db = initDb(":memory:");
});

describe("recordCostEvent", () => {
	it("inserts a chat cost row", () => {
		recordCostEvent(db, {
			id: "ce1",
			kind: "chat",
			model: "MiniMax-Text-01",
			inputTokens: 50,
			outputTokens: 100,
			costUsd: 0.001,
		});
		const summary = getDailySummary(db, 7);
		expect(summary).toHaveLength(1);
		expect(summary[0].totalInputTokens).toBe(50);
		expect(summary[0].totalOutputTokens).toBe(100);
	});

	it("inserts a TTS cost row", () => {
		recordCostEvent(db, {
			id: "ce2",
			kind: "tts",
			model: "Speech-02-Turbo",
			characters: 200,
			costUsd: 0.0005,
		});
		const summary = getDailySummary(db, 7);
		expect(summary).toHaveLength(1);
	});
});

describe("getDailySummary", () => {
	it("returns empty array when no events", () => {
		expect(getDailySummary(db, 7)).toHaveLength(0);
	});

	it("aggregates multiple events on the same day", () => {
		recordCostEvent(db, {
			id: "ce3",
			kind: "chat",
			model: "MiniMax-Text-01",
			inputTokens: 10,
			outputTokens: 20,
			costUsd: 0.0002,
		});
		recordCostEvent(db, {
			id: "ce4",
			kind: "chat",
			model: "MiniMax-Text-01",
			inputTokens: 5,
			outputTokens: 10,
			costUsd: 0.0001,
		});
		const summary = getDailySummary(db, 7);
		expect(summary).toHaveLength(1);
		expect(summary[0].totalInputTokens).toBe(15);
		expect(summary[0].totalOutputTokens).toBe(30);
	});
});
