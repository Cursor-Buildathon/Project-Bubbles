import { type TaskEvent } from '../shared/types.js';

export type TaskEventType = TaskEvent['type'];

interface AgentBirthTaskEventOptions {
  agentName: string;
  approvalId: string;
  taskId: string;
}

interface AgentBirthDraftingTaskEventOptions {
  taskId: string;
  userText: string;
}

export function createTaskEvent(taskId: string, type: TaskEventType, payload: Record<string, unknown> = {}): TaskEvent {
  return {
    taskId,
    type,
    payload,
    createdAt: new Date().toISOString()
  };
}

export function createAgentBirthDraftingTaskEvents({ taskId, userText }: AgentBirthDraftingTaskEventOptions): TaskEvent[] {
  return [
    createTaskEvent(taskId, 'task.received', {
      activeAgentId: 'general-assistant',
      taskType: 'agent.create',
      userText
    }),
    createTaskEvent(taskId, 'task.status', {
      status: 'running',
      text: 'Drafting agent files.'
    })
  ];
}

export function createAgentBirthTaskEvents({ agentName, approvalId, taskId }: AgentBirthTaskEventOptions): TaskEvent[] {
  return [
    createTaskEvent(taskId, 'task.status', {
      status: 'waiting_approval',
      text: `${agentName} draft is ready for approval.`
    }),
    createTaskEvent(taskId, 'approval.required', {
      approvalId,
      text: 'Approve agent file creation to continue.'
    })
  ];
}
