import { app, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  buildTaskPacket,
  classifyIntent,
  createMiniMaxTaskRunner,
  mapTaskEventToAvatarState,
  type MemoryItem,
  type AvatarState,
  type TaskEvent
} from '@bubbles/core';

type TaskPreflightResult =
  | { ok: true }
  | {
      ok: false;
      category?: string;
      error: string;
      hint?: string;
    };

interface RegisterTaskIpcOptions {
  getMiniMaxApiKey: () => Promise<string | undefined>;
  logDir: string;
  onTaskEvent: (event: TaskEvent, avatarState: AvatarState) => void;
  onTaskStarted: (userText: string, taskId: string) => void;
  preflight?: () => Promise<TaskPreflightResult>;
  getActiveAgentId?: () => string;
  getMemoryContext?: (userText: string, activeAgentId: string) => Promise<MemoryItem[]>;
  projectRoot?: string;
}

export interface TaskIpcController {
  cancelTask: (taskId: string) => boolean;
  getEvents: () => TaskEvent[];
  startTask: (userText: string) => Promise<{ taskId: string }>;
}

export function registerTaskIpc({
  getMiniMaxApiKey,
  logDir,
  onTaskEvent,
  onTaskStarted,
  preflight,
  getActiveAgentId = () => 'general-assistant',
  getMemoryContext = async () => [],
  projectRoot = resolveProjectRoot()
}: RegisterTaskIpcOptions): TaskIpcController {
  const events: TaskEvent[] = [];
  const runners = new Map<string, ReturnType<typeof createMiniMaxTaskRunner>>();
  const knownTasks = new Set<string>();
  const pendingCancels = new Set<string>();

  function settleEarly(taskId: string, event: TaskEvent) {
    events.push(event);
    onTaskEvent(event, mapTaskEventToAvatarState(event));
    knownTasks.delete(taskId);
    pendingCancels.delete(taskId);
  }

  async function startTask(userText: string) {
    const intent = classifyIntent(userText);
    const activeAgentId = intent.suggestedAgentId || getActiveAgentId();
    const packet = await buildTaskPacket({
      activeAgentId,
      memoryContext: await getMemoryContext(userText, activeAgentId),
      projectRoot,
      taskType: intent.taskType,
      userText
    });

    onTaskStarted(userText, packet.taskId);
    knownTasks.add(packet.taskId);

    void (async () => {
      if (pendingCancels.has(packet.taskId)) {
        settleEarly(packet.taskId, createTaskCancelled(packet.taskId));
        return;
      }

      const preflightEvent = await runPreflight(packet.taskId, preflight);

      if (preflightEvent) {
        settleEarly(packet.taskId, preflightEvent);
        return;
      }

      if (pendingCancels.has(packet.taskId)) {
        settleEarly(packet.taskId, createTaskCancelled(packet.taskId));
        return;
      }

      const apiKey = await getMiniMaxApiKey();

      if (!apiKey) {
        const event = createTaskError(packet.taskId, {
          category: 'auth',
          errorMessage: 'MiniMax Token Plan key is required before running tasks.',
          preflight: true
        });
        settleEarly(packet.taskId, event);
        return;
      }

      const runner = createMiniMaxTaskRunner({ apiKey, logDir });
      runners.set(packet.taskId, runner);

      if (pendingCancels.has(packet.taskId)) {
        runner.cancel(packet.taskId);
      }

      await runner.start(packet, (event) => {
        events.push(event);
        onTaskEvent(event, mapTaskEventToAvatarState(event));
      });
      runners.delete(packet.taskId);
      knownTasks.delete(packet.taskId);
      pendingCancels.delete(packet.taskId);
    })();

    return { taskId: packet.taskId };
  }

  const controller: TaskIpcController = {
    cancelTask: (taskId) => {
      const runner = runners.get(taskId);

      if (runner) {
        pendingCancels.delete(taskId);
        return runner.cancel(taskId);
      }

      if (!knownTasks.has(taskId)) {
        return false;
      }

      pendingCancels.add(taskId);
      return true;
    },
    getEvents: () => [...events],
    startTask
  };

  ipcMain.handle('tasks:start', (_event, userText: string) => startTask(userText));
  ipcMain.handle('tasks:cancel', (_event, taskId: string) => controller.cancelTask(taskId));
  ipcMain.handle('tasks:get-events', () => controller.getEvents());

  return controller;
}

async function runPreflight(taskId: string, preflight: RegisterTaskIpcOptions['preflight']) {
  if (!preflight) {
    return undefined;
  }

  const result = await preflight();

  if (result.ok) {
    return undefined;
  }

  return createTaskError(taskId, {
    category: result.category ?? 'unknown',
    errorMessage: result.error,
    hint: result.hint,
    preflight: true
  });
}

function createTaskError(taskId: string, payload: Record<string, unknown>): TaskEvent {
  return {
    taskId,
    type: 'task.error',
    payload,
    createdAt: new Date().toISOString()
  };
}

function createTaskCancelled(taskId: string): TaskEvent {
  return {
    taskId,
    type: 'task.cancelled',
    payload: { signal: 'abort' },
    createdAt: new Date().toISOString()
  };
}

function resolveProjectRoot() {
  const candidates = [resolve(app.getAppPath(), '../..'), resolve(process.cwd()), resolve(process.cwd(), '../..')];

  return candidates.find((candidate) => existsSync(join(candidate, 'agents', 'general-assistant', 'agent.json'))) ?? process.cwd();
}
