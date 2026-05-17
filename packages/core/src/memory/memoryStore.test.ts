import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createSqliteMemoryStore } from './memoryStore.js';

describe('createSqliteMemoryStore', () => {
  it('stores, queries, and clears memories in a SQLite database file', async () => {
    const store = await createSqliteMemoryStore({
      databasePath: join(tmpdir(), `bubbles-memory-${Date.now()}.sqlite`),
      now: () => '2026-05-14T03:00:00.000Z'
    });

    const preference = await store.create({
      type: 'user_preference',
      content: 'Prefers short plans.',
      agentId: 'general-assistant',
      tags: ['style', 'plans'],
      importance: 4
    });
    await store.create({
      type: 'project_context',
      content: 'Project uses Electron.',
      tags: ['project'],
      importance: 3
    });

    expect(preference.id).toMatch(/^mem-/);
    await expect(store.query({ type: 'user_preference', agentId: 'general-assistant', tags: ['style'] })).resolves.toEqual([
      preference
    ]);
    await expect(store.query({ limit: 1 })).resolves.toHaveLength(1);

    await store.deleteAll();
    await expect(store.list()).resolves.toEqual([]);
  });

  it('redacts key-like strings before persisting durable memory', async () => {
    const store = await createSqliteMemoryStore({
      databasePath: join(tmpdir(), `bubbles-memory-${Date.now()}.sqlite`),
      now: () => '2026-05-14T03:00:00.000Z'
    });

    const memory = await store.create({
      type: 'user_preference',
      content: 'my fake test key is sk-cp-1234567890abcdef',
      tags: ['explicit'],
      importance: 4
    });

    expect(memory.content).toBe('my fake test key is [REDACTED]');
    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({
        content: 'my fake test key is [REDACTED]'
      })
    ]);
  });
});
