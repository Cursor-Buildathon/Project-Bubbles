import type { Db } from "../db";

export interface ProjectRow {
	id: string;
	name: string;
	root_path: string;
	created_at: number;
}

export function insertProject(
	db: Db,
	project: { id: string; name: string; rootPath: string },
): void {
	db.prepare(
		"INSERT INTO projects (id, name, root_path, created_at) VALUES (?, ?, ?, ?)",
	).run(project.id, project.name, project.rootPath, Date.now());
}

export function listProjects(db: Db): ProjectRow[] {
	return db
		.prepare("SELECT * FROM projects ORDER BY created_at DESC")
		.all() as ProjectRow[];
}

export function getProject(db: Db, id: string): ProjectRow | undefined {
	return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
		| ProjectRow
		| undefined;
}
