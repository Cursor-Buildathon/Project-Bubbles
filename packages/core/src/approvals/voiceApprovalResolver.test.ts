import { describe, expect, it, vi } from 'vitest';
import { createVoiceApprovalResolver } from './voiceApprovalResolver.js';
import { type ApprovalRequest } from '../shared/types.js';

describe('createVoiceApprovalResolver', () => {
  it('approves, denies, and cancels a pending approval from speech', async () => {
    const approval = createApproval();
    const service = {
      approve: vi.fn().mockResolvedValue({ ...approval, status: 'approved' }),
      cancel: vi.fn().mockResolvedValue({ ...approval, status: 'cancelled' }),
      deny: vi.fn().mockResolvedValue({ ...approval, status: 'denied' }),
      list: vi.fn().mockResolvedValue([approval])
    };
    const resolver = createVoiceApprovalResolver({ approvalService: service, enabled: true });

    await expect(resolver.resolve({ approvalId: approval.id, voiceTurnId: 'voice-1', transcript: 'approve it' })).resolves.toMatchObject({
      decision: { decision: 'approved' },
      resolvedApproval: { status: 'approved' }
    });
    await resolver.resolve({ approvalId: approval.id, voiceTurnId: 'voice-2', transcript: 'no' });
    await resolver.resolve({ approvalId: approval.id, voiceTurnId: 'voice-3', transcript: 'cancel that' });

    expect(service.approve).toHaveBeenCalledWith(approval.id);
    expect(service.deny).toHaveBeenCalledWith(approval.id);
    expect(service.cancel).toHaveBeenCalledWith(approval.id);
  });

  it('reprompts once and falls back to chat on the second unclear attempt', async () => {
    const approval = createApproval({ title: 'Send email' });
    const resolver = createVoiceApprovalResolver({
      approvalService: {
        approve: vi.fn(),
        cancel: vi.fn(),
        deny: vi.fn(),
        list: vi.fn().mockResolvedValue([approval])
      },
      enabled: true
    });

    await expect(resolver.resolve({ approvalId: approval.id, voiceTurnId: 'voice-1', transcript: 'maybe' })).resolves.toMatchObject({
      attemptCount: 1,
      fallbackRequired: false,
      message: 'I did not catch that. Say approve, deny, or cancel for Send email.'
    });
    await expect(resolver.resolve({ approvalId: approval.id, voiceTurnId: 'voice-2', transcript: 'not sure' })).resolves.toMatchObject({
      attemptCount: 2,
      fallbackRequired: true,
      message: 'I could not tell whether to approve Send email. Please use the approval buttons in chat.'
    });
  });

  it('keeps approvals click-only when voice approvals are disabled', async () => {
    const approval = createApproval();
    const resolver = createVoiceApprovalResolver({
      approvalService: {
        approve: vi.fn(),
        cancel: vi.fn(),
        deny: vi.fn(),
        list: vi.fn().mockResolvedValue([approval])
      },
      enabled: false
    });

    await expect(resolver.resolve({ approvalId: approval.id, voiceTurnId: 'voice-1', transcript: 'approve' })).resolves.toMatchObject({
      fallbackRequired: true,
      message: 'Voice approvals are off. Please use the approval buttons in chat.'
    });
  });
});

function createApproval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'approval-1',
    taskId: 'task-1',
    agentId: 'general-assistant',
    actionType: 'send_email',
    risk: 'high',
    title: 'Send email',
    explanation: 'Preview before sending.',
    preview: { to: 'alex@example.com' },
    status: 'pending',
    createdAt: '2026-05-15T00:00:00.000Z',
    ...overrides
  };
}
