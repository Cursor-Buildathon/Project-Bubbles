import { describe, expect, it } from 'vitest';
import { createAgentBirthDraftingTaskEvents, createAgentBirthTaskEvents } from './taskEvents.js';

describe('createAgentBirthDraftingTaskEvents', () => {
  it('creates visible running task drawer events before agent birth drafting starts', () => {
    const events = createAgentBirthDraftingTaskEvents({
      taskId: 'task-agent-1',
      userText: 'create a QA agent'
    });

    expect(events).toMatchObject([
      {
        taskId: 'task-agent-1',
        type: 'task.received',
        payload: {
          activeAgentId: 'general-assistant',
          taskType: 'agent.create',
          userText: 'create a QA agent'
        }
      },
      {
        taskId: 'task-agent-1',
        type: 'task.status',
        payload: {
          status: 'running',
          text: 'Drafting agent files.'
        }
      }
    ]);
  });
});

describe('createAgentBirthTaskEvents', () => {
  it('creates approval task drawer events for chat-driven agent birth', () => {
    const events = createAgentBirthTaskEvents({
      agentName: 'AQ Agent',
      approvalId: 'approval-agent-1',
      taskId: 'task-agent-1'
    });

    expect(events).toMatchObject([
      {
        taskId: 'task-agent-1',
        type: 'task.status',
        payload: {
          status: 'waiting_approval',
          text: 'AQ Agent draft is ready for approval.'
        }
      },
      {
        taskId: 'task-agent-1',
        type: 'approval.required',
        payload: {
          approvalId: 'approval-agent-1',
          text: 'Approve agent file creation to continue.'
        }
      }
    ]);
  });
});
