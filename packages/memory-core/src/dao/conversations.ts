import type { Db } from "../db";

export interface ConversationRow {
	id: string;
	agent_id: string;
	project_id: string | null;
	started_at: number;
	summary: string | null;
}

export function insertConversation(
	db: Db,
	conv: {
		id: string;
		agentId: string;
		projectId?: string | null;
	},
): void {
	db.prepare(
		"INSERT INTO conversations (id, agent_id, project_id, started_at, summary) VALUES (?, ?, ?, ?, NULL)",
	).run(conv.id, conv.agentId, conv.projectId ?? null, Date.now());
}

export function getConversation(
	db: Db,
	id: string,
): ConversationRow | undefined {
	return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
		| ConversationRow
		| undefined;
}

export function getLatestConversation(db: Db): ConversationRow | undefined {
	return db
		.prepare("SELECT * FROM conversations ORDER BY started_at DESC LIMIT 1")
		.get() as ConversationRow | undefined;
}

export function updateConversationSummary(
	db: Db,
	id: string,
	summary: string,
): void {
	db.prepare("UPDATE conversations SET summary = ? WHERE id = ?").run(
		summary,
		id,
	);
}
