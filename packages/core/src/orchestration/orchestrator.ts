import { buildTaskPacket, type BuildTaskPacketOptions } from '../cli/taskPacketBuilder.js';
import { type CliBridge } from '../cli/cliBridge.js';
import { type AvatarState, type CliEvent } from '../shared/types.js';

export interface TaskOrchestrator {
  cancelTask: (taskId: string) => boolean;
  getEvents: () => CliEvent[];
  startTask: (options: BuildTaskPacketOptions, onEvent?: (event: CliEvent, avatarState: AvatarState) => void) => Promise<CliEvent>;
}

export function createTaskOrchestrator(bridge: CliBridge): TaskOrchestrator {
  const events: CliEvent[] = [];

  return {
    cancelTask(taskId) {
      return bridge.cancel(taskId);
    },

    getEvents() {
      return [...events];
    },

    async startTask(options, onEvent) {
      const packet = await buildTaskPacket(options);

      return bridge.start(packet, (event) => {
        events.push(event);
        onEvent?.(event, mapCliEventToAvatarState(event));
      });
    }
  };
}

export function mapCliEventToAvatarState(event: Pick<CliEvent, 'type'> & { payload?: Record<string, unknown> }): AvatarState {
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
