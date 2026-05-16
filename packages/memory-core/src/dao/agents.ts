import type { Db } from "../db";

export interface AgentRow {
	id: string;
	name: string;
	role: string;
	voice_id: string;
	skin_id: string;
	skills_md_path: string;
	project_id: string | null;
	created_at: number;
}

export function upsertAgent(
	db: Db,
	agent: {
		id: string;
		name: string;
		role?: string;
		voiceId?: string;
		skinId?: string;
		skillsMdPath?: string;
		projectId?: string | null;
	},
): void {
	db.prepare(
		`INSERT INTO agents (
			id, name, role, voice_id, skin_id, skills_md_path, project_id, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			role = excluded.role,
			voice_id = excluded.voice_id,
			skin_id = excluded.skin_id,
			skills_md_path = excluded.skills_md_path,
			project_id = excluded.project_id`,
	).run(
		agent.id,
		agent.name,
		agent.role ?? "assistant",
		agent.voiceId ?? "",
		agent.skinId ?? "",
		agent.skillsMdPath ?? "",
		agent.projectId ?? null,
		Date.now(),
	);
}

export function getAgentRow(db: Db, id: string): AgentRow | undefined {
	return db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as
		| AgentRow
		| undefined;
}
