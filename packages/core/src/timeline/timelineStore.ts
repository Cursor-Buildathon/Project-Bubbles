import { type TimelineEvent, type TimelineEventType } from '../shared/types.js';
import { openSqliteDatabase } from '../shared/sqliteDatabase.js';
import { redactSecrets } from '../security/redactSecrets.js';

const schemaSql = `
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  taskId TEXT,
  agentId TEXT,
  memoryId TEXT,
  metadata TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
`;

export interface CreateTimelineEventInput {
  type: TimelineEventType;
  title: string;
  summary: string;
  taskId?: string;
  agentId?: string;
  memoryId?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineStore {
  append: (input: CreateTimelineEventInput) => Promise<TimelineEvent>;
  list: (limit?: number) => Promise<TimelineEvent[]>;
}

interface TimelineStoreOptions {
  databasePath: string;
  now?: () => string;
}

export async function createSqliteTimelineStore({
  databasePath,
  now = () => new Date().toISOString()
}: TimelineStoreOptions): Promise<TimelineStore> {
  const { database, persist } = await openSqliteDatabase(databasePath, schemaSql);
  await redactExistingTimelineSummaries();

  async function append(input: CreateTimelineEventInput): Promise<TimelineEvent> {
    const event: TimelineEvent = {
      ...input,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      summary: redactSecrets(input.summary),
      metadata: input.metadata ?? {},
      createdAt: now()
    };

    database.run(
      `INSERT INTO timeline_events (id, type, title, summary, taskId, agentId, memoryId, metadata, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.type,
        event.title,
        event.summary,
        event.taskId ?? null,
        event.agentId ?? null,
        event.memoryId ?? null,
        JSON.stringify(event.metadata),
        event.createdAt
      ]
    );
    await persist();
    return event;
  }

  return {
    append,
    async list(limit) {
      const result = database.exec(
        `SELECT * FROM timeline_events ORDER BY createdAt DESC${limit ? ` LIMIT ${Math.max(1, Math.floor(limit))}` : ''}`
      )[0];

      return (result?.values ?? []).map((row) => ({
        id: String(row[0]),
        type: row[1] as TimelineEventType,
        title: String(row[2]),
        summary: String(row[3]),
        taskId: row[4] ? String(row[4]) : undefined,
        agentId: row[5] ? String(row[5]) : undefined,
        memoryId: row[6] ? String(row[6]) : undefined,
        metadata: JSON.parse(String(row[7])) as Record<string, unknown>,
        createdAt: String(row[8])
      }));
    }
  };

  async function redactExistingTimelineSummaries() {
    const rows = database.exec('SELECT id, summary FROM timeline_events')[0]?.values ?? [];
    let changed = false;

    for (const row of rows) {
      const id = String(row[0]);
      const summary = String(row[1]);
      const redactedSummary = redactSecrets(summary);

      if (redactedSummary === summary) {
        continue;
      }

      changed = true;
      database.run('UPDATE timeline_events SET summary = ? WHERE id = ?', [redactedSummary, id]);
    }

    if (changed) {
      await persist();
    }
  }
}
