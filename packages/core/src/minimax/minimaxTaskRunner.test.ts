import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMiniMaxTaskRunner } from './minimaxTaskRunner.js';
import { type TaskEvent, type TaskPacket } from '../shared/types.js';

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'bubbles-task-logs-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('createMiniMaxTaskRunner', () => {
  it('runs task packets through direct MiniMax text generation and writes redacted logs', async () => {
    const logDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '<think>private</think>\nTask complete.' } }]
      })
    });
    const runner = createMiniMaxTaskRunner({ apiKey: 'sk-cp-secret', fetch: fetchMock, logDir });
    const events: TaskEvent[] = [];

    const finalEvent = await runner.start(createPacket({ userText: 'Plan my day' }), (event) => events.push(event));

    expect(finalEvent).toMatchObject({
      type: 'task.result',
      payload: { text: 'Task complete.' }
    });
    expect(events.map((event) => event.type)).toEqual(['task.received', 'task.status', 'task.result']);
    const log = await readFile(join(logDir, 'task-1.log'), 'utf8');
    expect(log).toContain('Plan my day');
    expect(log).not.toContain('sk-cp-secret');
  });

  it('cancels an active direct MiniMax task with AbortController', async () => {
    const logDir = await makeTempDir();
    let rejectFetch: ((error: unknown) => void) | undefined;
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<never>((_, reject) => {
          rejectFetch = reject;
          if (init.signal?.aborted) {
            reject(new DOMException('aborted', 'AbortError'));
            return;
          }
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
    );
    const runner = createMiniMaxTaskRunner({ apiKey: 'sk-cp-token', fetch: fetchMock, logDir });
    const events: TaskEvent[] = [];
    const result = runner.start(createPacket(), (event) => events.push(event));

    expect(runner.cancel('task-1')).toBe(true);
    rejectFetch?.(new DOMException('aborted', 'AbortError'));

    await expect(result).resolves.toMatchObject({
      type: 'task.cancelled',
      payload: { signal: 'abort' }
    });
    expect(events.at(-1)?.type).toBe('task.cancelled');
  });

  it('turns direct MiniMax auth errors into categorized task errors', async () => {
    const logDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid key sk-cp-secret'
    });
    const runner = createMiniMaxTaskRunner({ apiKey: 'sk-cp-secret', fetch: fetchMock, logDir });

    await expect(runner.start(createPacket(), () => undefined)).resolves.toMatchObject({
      type: 'task.error',
      payload: {
        category: 'auth',
        errorMessage: 'MiniMax API authentication failed. Recheck the Token Plan key in Settings.'
      }
    });
  });
});

function createPacket(overrides: Partial<TaskPacket> = {}): TaskPacket {
  return {
    taskId: 'task-1',
    userText: 'Help me',
    activeAgentId: 'general-assistant',
    taskType: 'general.plan',
    mode: 'plan_then_act',
    memoryContext: [],
    skillsMarkdown: '# Assistant',
    allowedTools: ['minimax.text'],
    approvalPolicy: 'preview_sensitive_actions',
    outputPreference: {
      userLevel: 'nontechnical',
      responseStyle: 'clear_spoken_summary',
      includeTechnicalDetails: false
    },
    ...overrides
  };
}
