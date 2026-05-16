import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createSqliteTimelineStore } from './timelineStore.js';

describe('createSqliteTimelineStore', () => {
  it('appends and lists newest timeline events first', async () => {
    let tick = 0;
    const store = await createSqliteTimelineStore({
      databasePath: join(tmpdir(), `bubbles-timeline-${Date.now()}.sqlite`),
      now: () => `2026-05-14T03:00:0${tick++}.000Z`
    });

    await store.append({
      type: 'memory_created',
      title: 'Remembered preference',
      summary: 'Prefers short plans.',
      agentId: 'general-assistant',
      metadata: { memoryId: 'mem-1' }
    });
    await store.append({
      type: 'task_completed',
      title: 'Task completed',
      summary: 'Summarized the project.',
      taskId: 'task-1',
      metadata: { exitCode: 0 }
    });

    await expect(store.list()).resolves.toMatchObject([
      { type: 'task_completed', taskId: 'task-1' },
      { type: 'memory_created', agentId: 'general-assistant' }
    ]);
  });

  it('redacts key-like strings from timeline summaries', async () => {
    const store = await createSqliteTimelineStore({
      databasePath: join(tmpdir(), `bubbles-timeline-${Date.now()}.sqlite`),
      now: () => '2026-05-14T03:00:00.000Z'
    });

    const event = await store.append({
      type: 'memory_created',
      title: 'Memory saved',
      summary: 'my fake test key is sk-cp-1234567890abcdef'
    });

    expect(event.summary).toBe('my fake test key is [REDACTED]');
    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({
        summary: 'my fake test key is [REDACTED]'
      })
    ]);
  });
});
