import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createApprovalService } from './approvalService.js';

describe('createApprovalService', () => {
  it('creates redacted approval requests and resolves approval decisions', async () => {
    const service = await createApprovalService({
      databasePath: join(tmpdir(), `bubbles-approvals-${Date.now()}.sqlite`),
      now: () => '2026-05-14T04:00:00.000Z'
    });

    const approval = await service.create({
      taskId: 'task-1',
      agentId: 'general-assistant',
      actionType: 'external_data_send',
      title: 'Send external data',
      explanation: 'Bubbles wants to send this data.',
      preview: {
        to: 'friend@example.com',
        body: 'Token sk-cp-secret should not leak'
      }
    });

    expect(approval).toMatchObject({
      taskId: 'task-1',
      agentId: 'general-assistant',
      actionType: 'external_data_send',
      risk: 'high',
      status: 'pending'
    });
    expect(JSON.stringify(approval.preview)).not.toContain('sk-cp-secret');
    await expect(service.requireApproved(approval.id)).rejects.toThrow('Approval is pending.');

    const approved = await service.approve(approval.id);

    expect(approved.status).toBe('approved');
    expect(approved.resolvedAt).toBe('2026-05-14T04:00:00.000Z');
    await expect(service.requireApproved(approval.id)).resolves.toEqual(approved);
  });

  it('denies and cancels pending approvals without allowing execution', async () => {
    const service = await createApprovalService({
      databasePath: join(tmpdir(), `bubbles-approvals-denied-${Date.now()}.sqlite`)
    });

    const denied = await service.create({
      taskId: 'task-2',
      agentId: 'general-assistant',
      actionType: 'file_write',
      title: 'Write file',
      explanation: 'Write a project file.',
      preview: { path: '/tmp/app.ts' }
    });
    const cancelled = await service.create({
      taskId: 'task-3',
      agentId: 'general-assistant',
      actionType: 'shell_command',
      title: 'Run command',
      explanation: 'Run a shell command.',
      preview: { command: 'npm test' }
    });

    await expect(service.deny(denied.id)).resolves.toMatchObject({ status: 'denied' });
    await expect(service.cancel(cancelled.id)).resolves.toMatchObject({ status: 'cancelled' });
    await expect(service.requireApproved(denied.id)).rejects.toThrow('Approval was denied.');
    await expect(service.requireApproved(cancelled.id)).rejects.toThrow('Approval was cancelled.');
  });
});
