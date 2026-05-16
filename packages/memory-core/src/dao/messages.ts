import type { Db } from "../db";

export interface MessageRow {
	id: string;
	conversation_id: string;
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	tool_calls: string | null;
	created_at: number;
}

export function insertMessage(
	db: Db,
	msg: {
		id: string;
		conversationId: string;
		role: "user" | "assistant" | "system" | "tool";
		content: string;
		toolCalls?: object | null;
	},
): void {
	db.prepare(
		"INSERT INTO messages (id, conversation_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)",
	).run(
		msg.id,
		msg.conversationId,
		msg.role,
		msg.content,
		msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
		Date.now(),
	);
}

export function getMessagesByConversation(
	db: Db,
	conversationId: string,
): MessageRow[] {
	return db
		.prepare(
			"SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
		)
		.all(conversationId) as MessageRow[];
}
