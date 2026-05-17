import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactSecrets } from '../security/redactSecrets.js';
import { type TaskEvent, type TaskPacket } from '../shared/types.js';
import { createTaskEvent } from '../tasks/taskEvents.js';
import { generateMiniMaxText, MiniMaxApiError } from './minimaxApiClient.js';

interface ResponseLike {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

export interface MiniMaxTaskRunner {
  cancel: (taskId: string) => boolean;
  getEvents: () => TaskEvent[];
  start: (packet: TaskPacket, onEvent: (event: TaskEvent) => void) => Promise<TaskEvent>;
}

interface MiniMaxTaskRunnerOptions {
  apiKey: string;
  fetch?: FetchLike;
  logDir: string;
}

export function createMiniMaxTaskRunner({
  apiKey,
  fetch: fetchImpl = globalThis.fetch as FetchLike,
  logDir
}: MiniMaxTaskRunnerOptions): MiniMaxTaskRunner {
  const controllers = new Map<string, AbortController>();
  const knownTasks = new Set<string>();
  const events: TaskEvent[] = [];

  async function emit(logPath: string, event: TaskEvent, onEvent: (event: TaskEvent) => void) {
    events.push(event);
    await appendTaskLog(logDir, logPath, JSON.stringify(event));
    onEvent(event);
  }

  return {
    cancel(taskId) {
      const controller = controllers.get(taskId);

      if (!controller) {
        return knownTasks.has(taskId);
      }

      controller.abort();
      return true;
    },

    getEvents() {
      return [...events];
    },

    async start(packet, onEvent) {
      const logPath = join(logDir, `${packet.taskId}.log`);
      const controller = new AbortController();
      controllers.set(packet.taskId, controller);
      knownTasks.add(packet.taskId);

      await appendTaskLog(logDir, logPath, JSON.stringify({ packet }));
      await emit(logPath, createTaskEvent(packet.taskId, 'task.received', { activeAgentId: packet.activeAgentId }), onEvent);
      await emit(logPath, createTaskEvent(packet.taskId, 'task.status', { status: 'running' }), onEvent);

      try {
        const text = await generateMiniMaxText(apiKey, createTaskPrompt(packet), {
          fetch: (input, init) =>
            fetchImpl(input, {
              ...init,
              signal: controller.signal
            })
        });
        const event = createTaskEvent(packet.taskId, 'task.result', { text });
        await emit(logPath, event, onEvent);
        return event;
      } catch (error) {
        const event = controller.signal.aborted
          ? createTaskEvent(packet.taskId, 'task.cancelled', { signal: 'abort' })
          : createErrorEvent(packet.taskId, error);
        await emit(logPath, event, onEvent);
        return event;
      } finally {
        controllers.delete(packet.taskId);
        knownTasks.delete(packet.taskId);
      }
    }
  };
}

function createTaskPrompt(packet: TaskPacket) {
  return [
    'You are Bubbles, a warm desktop assistant. Use this structured task packet as context.',
    'Return a concise, user-facing answer. Do not expose internal reasoning.',
    JSON.stringify(packet)
  ].join('\n\n');
}

function createErrorEvent(taskId: string, error: unknown): TaskEvent {
  if (error instanceof MiniMaxApiError) {
    return createTaskEvent(taskId, 'task.error', {
      category: error.category,
      errorMessage: error.message,
      rawMessage: redactSecrets(error)
    });
  }

  return createTaskEvent(taskId, 'task.error', {
    category: 'unknown',
    errorMessage: redactSecrets(error)
  });
}

async function appendTaskLog(logDir: string, logPath: string, line: string) {
  await mkdir(logDir, { recursive: true });
  await appendFile(logPath, `${redactSecrets(line)}\n`, 'utf8');
}
