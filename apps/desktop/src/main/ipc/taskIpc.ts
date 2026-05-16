import { app, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildTaskPacket,
  classifyIntent,
  createCliBridge,
  mapCliEventToAvatarState,
  type MemoryItem,
  type AvatarState,
  type CliBridgeOptions,
  type CliEvent,
  type TaskPacket
} from '@bubbles/core';

interface RegisterTaskIpcOptions {
  logDir: string;
  minimaxCliPrefix: string;
  onTaskEvent: (event: CliEvent, avatarState: AvatarState) => void;
  onTaskStarted: (userText: string, taskId: string) => void;
  preflight?: CliBridgeOptions['preflight'];
  getActiveAgentId?: () => string;
  getMemoryContext?: (userText: string, activeAgentId: string) => Promise<MemoryItem[]>;
  projectRoot?: string;
}

export interface TaskIpcController {
  cancelTask: (taskId: string) => boolean;
  getEvents: () => CliEvent[];
  startTask: (userText: string) => Promise<{ taskId: string }>;
}

export function registerTaskIpc({
  logDir,
  minimaxCliPrefix,
  onTaskEvent,
  onTaskStarted,
  preflight,
  getActiveAgentId = () => 'general-assistant',
  getMemoryContext = async () => [],
  projectRoot = resolveProjectRoot()
}: RegisterTaskIpcOptions): TaskIpcController {
  const events: CliEvent[] = [];
  const bridge = createCliBridge({
    logDir,
    preflight,
    resolveCommand: (packet) => createMiniMaxCommand(packet, minimaxCliPrefix)
  });

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
    void bridge.start(packet, (event) => {
      events.push(event);
      onTaskEvent(event, mapCliEventToAvatarState(event));
    });

    return { taskId: packet.taskId };
  }

  const controller: TaskIpcController = {
    cancelTask: (taskId) => bridge.cancel(taskId),
    getEvents: () => [...events],
    startTask
  };

  ipcMain.handle('tasks:start', (_event, userText: string) => startTask(userText));
  ipcMain.handle('tasks:cancel', (_event, taskId: string) => controller.cancelTask(taskId));
  ipcMain.handle('tasks:get-events', () => controller.getEvents());

  return controller;
}

function createMiniMaxCommand(packet: TaskPacket, minimaxCliPrefix: string) {
  const localBinary = join(minimaxCliPrefix, 'bin', 'mmx');

  return {
    command: localBinary,
    args: [
      'text',
      'chat',
      '--message',
      [
        'You are the CLI worker for Bubbles. Use this structured task packet as context.',
        JSON.stringify(packet)
      ].join('\n\n')
    ]
  };
}

function resolveProjectRoot() {
  const candidates = [resolve(app.getAppPath(), '../..'), resolve(process.cwd()), resolve(process.cwd(), '../..')];

  return candidates.find((candidate) => existsSync(join(candidate, 'agents', 'general-assistant', 'agent.json'))) ?? process.cwd();
}
