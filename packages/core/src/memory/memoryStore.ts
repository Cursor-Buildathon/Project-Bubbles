import { type MemoryItem, type MemoryQuery } from '../shared/types.js';
import { openSqliteDatabase } from '../shared/sqliteDatabase.js';
import { redactSecrets } from '../security/redactSecrets.js';

const schemaSql = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  sourceTaskId TEXT,
  agentId TEXT,
  tags TEXT NOT NULL,
  importance INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
`;

export type CreateMemoryInput = Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

export interface MemoryStore {
  create: (input: CreateMemoryInput) => Promise<MemoryItem>;
  deleteAll: () => Promise<void>;
  list: () => Promise<MemoryItem[]>;
  query: (query?: MemoryQuery) => Promise<MemoryItem[]>;
}

interface MemoryStoreOptions {
  databasePath: string;
  now?: () => string;
}

export async function createSqliteMemoryStore({
  databasePath,
  now = () => new Date().toISOString()
}: MemoryStoreOptions): Promise<MemoryStore> {
  const { database, persist } = await openSqliteDatabase(databasePath, schemaSql);
  await redactExistingMemoryContent();

  async function create(input: CreateMemoryInput): Promise<MemoryItem> {
    const timestamp = now();
    const memory: MemoryItem = {
      ...input,
      id: input.id ?? `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: redactSecrets(input.content),
      tags: input.tags ?? [],
      createdAt: input.createdAt ?? timestamp,
      updatedAt: input.updatedAt ?? timestamp
    };

    database.run(
      `INSERT INTO memories (id, type, content, sourceTaskId, agentId, tags, importance, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memory.id,
        memory.type,
        memory.content,
        memory.sourceTaskId ?? null,
        memory.agentId ?? null,
        JSON.stringify(memory.tags),
        memory.importance,
        memory.createdAt,
        memory.updatedAt
      ]
    );
    await persist();
    return memory;
  }

  async function list() {
    return rowsToMemories(
      database.exec('SELECT * FROM memories ORDER BY updatedAt DESC, createdAt DESC')[0]?.values ?? []
    );
  }

  async function query(memoryQuery: MemoryQuery = {}) {
    const memories = await list();
    const filtered = memories.filter((memory) => {
      if (memoryQuery.type && memory.type !== memoryQuery.type) {
        return false;
      }

      if (memoryQuery.agentId && memory.agentId && memory.agentId !== memoryQuery.agentId) {
        return false;
      }

      if (memoryQuery.tags?.length && !memoryQuery.tags.every((tag) => memory.tags.includes(tag))) {
        return false;
      }

      return true;
    });

    return filtered.slice(0, memoryQuery.limit ?? filtered.length);
  }

  return {
    create,
    async deleteAll() {
      database.run('DELETE FROM memories');
      await persist();
    },
    list,
    query
  };

  async function redactExistingMemoryContent() {
    const rows = database.exec('SELECT id, content FROM memories')[0]?.values ?? [];
    let changed = false;

    for (const row of rows) {
      const id = String(row[0]);
      const content = String(row[1]);
      const redactedContent = redactSecrets(content);

      if (redactedContent === content) {
        continue;
      }

      changed = true;
      database.run('UPDATE memories SET content = ?, updatedAt = ? WHERE id = ?', [redactedContent, now(), id]);
    }

    if (changed) {
      await persist();
    }
  }
}

function rowsToMemories(rows: unknown[][]): MemoryItem[] {
  return rows.map((row) => ({
    id: String(row[0]),
    type: row[1] as MemoryItem['type'],
    content: String(row[2]),
    sourceTaskId: row[3] ? String(row[3]) : undefined,
    agentId: row[4] ? String(row[4]) : undefined,
    tags: JSON.parse(String(row[5])) as string[],
    importance: Number(row[6]) as MemoryItem['importance'],
    createdAt: String(row[7]),
    updatedAt: String(row[8])
  }));
}
