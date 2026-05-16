import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

// Migration SQL inlined as a string so it survives electron-vite bundling
// (file system lookups against __dirname break when code is bundled into out/).
const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  root_path  TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL,
  voice_id       TEXT NOT NULL DEFAULT '',
  skin_id        TEXT NOT NULL DEFAULT '',
  skills_md_path TEXT NOT NULL DEFAULT '',
  project_id     TEXT REFERENCES projects(id),
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL REFERENCES agents(id),
  project_id TEXT REFERENCES projects(id),
  started_at INTEGER NOT NULL,
  summary    TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role            TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
  content         TEXT NOT NULL,
  tool_calls      TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id                TEXT PRIMARY KEY,
  kind              TEXT NOT NULL CHECK(kind IN ('agent','project','conversation','file','relationship')),
  scope             TEXT NOT NULL CHECK(scope IN ('agent','project','global')),
  agent_id          TEXT REFERENCES agents(id),
  project_id        TEXT REFERENCES projects(id),
  content           TEXT NOT NULL,
  source_message_id TEXT REFERENCES messages(id),
  created_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id           TEXT PRIMARY KEY,
  project_id   TEXT REFERENCES projects(id),
  path         TEXT NOT NULL,
  sha          TEXT NOT NULL DEFAULT '',
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id         TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  title      TEXT NOT NULL,
  rationale  TEXT NOT NULL,
  made_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  ref_id      TEXT,
  summary     TEXT NOT NULL,
  occurred_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id           TEXT PRIMARY KEY,
  tool_name    TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  decision     TEXT NOT NULL CHECK(decision IN ('allow','deny','allow_always')),
  decided_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_events (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK(kind IN ('chat','tts','tts_hd','embedding','image')),
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  characters    INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0,
  turn_id       TEXT,
  created_at    INTEGER NOT NULL
);
`;

const MIGRATIONS: Array<{ id: string; sql: string }> = [
	{ id: "001_initial.sql", sql: MIGRATION_001 },
];

function runMigrations(db: Db): void {
	db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

	const applied = new Set(
		(db.prepare("SELECT id FROM _migrations").all() as { id: string }[]).map(
			(r) => r.id,
		),
	);

	const insert = db.prepare(
		"INSERT INTO _migrations (id, applied_at) VALUES (?, ?)",
	);

	for (const migration of MIGRATIONS) {
		if (applied.has(migration.id)) continue;
		db.exec(migration.sql);
		insert.run(migration.id, Date.now());
	}
}

/**
 * Open (or create) the Bubbles SQLite database and run pending migrations.
 * Pass `:memory:` in tests to get an isolated in-memory database.
 */
export function initDb(dbPath?: string): Db {
	const resolvedPath = dbPath ?? `${homedir()}/.bubbles/memory.db`;

	if (resolvedPath !== ":memory:") {
		const dir = dirname(resolvedPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
	}

	const db = new Database(resolvedPath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");
	// Defensive: bound query time and busy-wait so concurrent access degrades gracefully
	db.pragma("busy_timeout = 5000");
	runMigrations(db);
	return db;
}
