import { buildTaskPacket, type BuildTaskPacketOptions } from '../tasks/taskPacketBuilder.js';
import { type AvatarState, type TaskEvent } from '../shared/types.js';

export interface TaskRunner {
  cancel: (taskId: string) => boolean;
  getEvents?: () => TaskEvent[];
  start: (packet: Awaited<ReturnType<typeof buildTaskPacket>>, onEvent: (event: TaskEvent) => void) => Promise<TaskEvent>;
}

export interface TaskOrchestrator {
  cancelTask: (taskId: string) => boolean;
  getEvents: () => TaskEvent[];
  startTask: (options: BuildTaskPacketOptions, onEvent?: (event: TaskEvent, avatarState: AvatarState) => void) => Promise<TaskEvent>;
}

export function createTaskOrchestrator(runner: TaskRunner): TaskOrchestrator {
  const events: TaskEvent[] = [];

  return {
    cancelTask(taskId) {
      return runner.cancel(taskId);
    },

    getEvents() {
      return runner.getEvents?.() ?? [...events];
    },

    async startTask(options, onEvent) {
      const packet = await buildTaskPacket(options);

      return runner.start(packet, (event) => {
        events.push(event);
        onEvent?.(event, mapTaskEventToAvatarState(event));
      });
    }
  };
}

export function mapTaskEventToAvatarState(event: Pick<TaskEvent, 'type'> & { payload?: Record<string, unknown> }): AvatarState {
  if (event.type === 'task.status' && event.payload?.status === 'missing_info') {
    return 'confused';
  }

  switch (event.type) {
    case 'task.received':
      return 'thinking';
    case 'task.status':
    case 'task.partial_output':
      return 'working';
    case 'approval.required':
      return 'waiting_approval';
    case 'task.error':
      return 'concerned';
    case 'task.result':
      return 'celebrating';
    case 'task.cancelled':
      return 'idle';
    default:
      return 'working';
  }
}
