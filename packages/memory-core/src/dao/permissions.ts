import type { Db } from "../db";

export interface PermissionRow {
	id: string;
	tool_name: string;
	payload_hash: string;
	decision: "allow" | "deny" | "allow_always";
	decided_at: number;
}

export function insertPermission(
	db: Db,
	perm: {
		id: string;
		toolName: string;
		payloadHash: string;
		decision: "allow" | "deny" | "allow_always";
	},
): void {
	db.prepare(
		"INSERT INTO permissions (id, tool_name, payload_hash, decision, decided_at) VALUES (?, ?, ?, ?, ?)",
	).run(perm.id, perm.toolName, perm.payloadHash, perm.decision, Date.now());
}

export function lookupPermission(
	db: Db,
	toolName: string,
	payloadHash: string,
): PermissionRow | undefined {
	return db
		.prepare(
			"SELECT * FROM permissions WHERE tool_name = ? AND payload_hash = ? ORDER BY decided_at DESC LIMIT 1",
		)
		.get(toolName, payloadHash) as PermissionRow | undefined;
}
