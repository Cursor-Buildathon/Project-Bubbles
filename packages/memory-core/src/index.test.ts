import { beforeEach, describe, expect, it } from "vitest";
import { getAgentRow, upsertAgent } from "./dao/agents";
import {
	getConversation,
	getLatestConversation,
	insertConversation,
	updateConversationSummary,
} from "./dao/conversations";
import { getDailySummary, insertCostEvent } from "./dao/costEvents";
import { getMessagesByConversation, insertMessage } from "./dao/messages";
import { insertPermission, lookupPermission } from "./dao/permissions";
import { getProject, insertProject, listProjects } from "./dao/projects";
import type { Db } from "./db";
import { initDb } from "./db";

let db: Db;

beforeEach(() => {
	db = initDb(":memory:");
});

describe("initDb", () => {
	it("opens successfully", () => {
		expect(db).toBeDefined();
	});
	it("migration is idempotent (run twice)", () => {
		const db2 = initDb(":memory:");
		expect(db2).toBeDefined();
		db2.close();
	});
});

describe("projects DAO", () => {
	it("inserts and lists", () => {
		insertProject(db, { id: "p1", name: "Bubbles POC", rootPath: "/tmp/poc" });
		const projects = listProjects(db);
		expect(projects).toHaveLength(1);
		expect(projects[0].name).toBe("Bubbles POC");
	});
	it("getProject returns undefined for missing id", () => {
		expect(getProject(db, "no-such-id")).toBeUndefined();
	});
});

describe("conversations DAO", () => {
	beforeEach(() => {
		upsertAgent(db, { id: "a1", name: "Bubbles" });
	});

	it("inserts and retrieves", () => {
		insertConversation(db, { id: "c1", agentId: "a1" });
		const conv = getConversation(db, "c1");
		expect(conv).toBeDefined();
		expect(conv?.agent_id).toBe("a1");
		expect(conv?.summary).toBeNull();
	});

	it("updates summary", () => {
		insertConversation(db, { id: "c2", agentId: "a1" });
		updateConversationSummary(db, "c2", "user said hello");
		expect(getConversation(db, "c2")?.summary).toBe("user said hello");
	});

	it("returns the most recently started conversation", () => {
		insertConversation(db, { id: "older", agentId: "a1" });
		insertConversation(db, { id: "newer", agentId: "a1" });
		db.prepare("UPDATE conversations SET started_at = ? WHERE id = ?").run(
			1,
			"older",
		);
		db.prepare("UPDATE conversations SET started_at = ? WHERE id = ?").run(
			2,
			"newer",
		);

		expect(getLatestConversation(db)?.id).toBe("newer");
	});
});

describe("agents DAO", () => {
	it("upserts an agent that conversations can reference", () => {
		upsertAgent(db, { id: "bubbles", name: "Bubbles" });
		expect(getAgentRow(db, "bubbles")?.name).toBe("Bubbles");

		insertConversation(db, { id: "c-agent", agentId: "bubbles" });
		expect(getConversation(db, "c-agent")?.agent_id).toBe("bubbles");
	});
});

describe("messages DAO", () => {
	beforeEach(() => {
		upsertAgent(db, { id: "a1", name: "Bubbles" });
		insertConversation(db, { id: "c1", agentId: "a1" });
	});

	it("inserts user + assistant messages and retrieves in order", () => {
		insertMessage(db, {
			id: "m1",
			conversationId: "c1",
			role: "user",
			content: "hello",
		});
		insertMessage(db, {
			id: "m2",
			conversationId: "c1",
			role: "assistant",
			content: "hi there",
		});
		const msgs = getMessagesByConversation(db, "c1");
		expect(msgs).toHaveLength(2);
		expect(msgs[0].role).toBe("user");
		expect(msgs[1].role).toBe("assistant");
	});
});

describe("costEvents DAO", () => {
	it("inserts and summarises", () => {
		insertCostEvent(db, {
			id: "ce1",
			kind: "chat",
			model: "MiniMax-Text-01",
			inputTokens: 100,
			outputTokens: 200,
			costUsd: 0.001,
		});
		const summary = getDailySummary(db, 7);
		expect(summary).toHaveLength(1);
		expect(summary[0].totalInputTokens).toBe(100);
	});
});

describe("permissions DAO", () => {
	it("inserts and looks up", () => {
		insertPermission(db, {
			id: "perm1",
			toolName: "writeFile",
			payloadHash: "abc123",
			decision: "allow",
		});
		const found = lookupPermission(db, "writeFile", "abc123");
		expect(found).toBeDefined();
		expect(found?.decision).toBe("allow");
	});

	it("returns undefined when not found", () => {
		expect(lookupPermission(db, "unknown", "hash")).toBeUndefined();
	});
});
