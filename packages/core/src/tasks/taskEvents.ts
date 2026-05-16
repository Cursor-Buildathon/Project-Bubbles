import { type TaskEvent } from '../shared/types.js';

export type TaskEventType = TaskEvent['type'];

export function createTaskEvent(taskId: string, type: TaskEventType, payload: Record<string, unknown> = {}): TaskEvent {
  return {
    taskId,
    type,
    payload,
    createdAt: new Date().toISOString()
  };
}
