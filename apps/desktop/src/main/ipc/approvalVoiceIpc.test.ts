import { describe, expect, it, vi } from 'vitest';
import { createApprovalVoiceIpcController, registerApprovalVoiceIpc } from './approvalVoiceIpc.js';

describe('approval voice IPC', () => {
  it('resolves an approval transcript and notifies the approval handler', async () => {
    const resolvedApproval = { id: 'approval-1', status: 'approved' };
    const resolver = {
      resolve: vi.fn().mockResolvedValue({
        decision: { approvalId: 'approval-1', voiceTurnId: 'voice-1', decision: 'approved', transcript: 'approve' },
        resolvedApproval,
        message: 'Send email was approved.',
        fallbackRequired: false,
        attemptCount: 0
      })
    };
    const onApprovalResolved = vi.fn();
    const controller = createApprovalVoiceIpcController({ resolver, onApprovalResolved });

    await expect(
      controller.resolve({
        approvalId: 'approval-1',
        voiceTurnId: 'voice-1',
        transcript: 'approve'
      })
    ).resolves.toMatchObject({
      message: 'Send email was approved.',
      decision: { decision: 'approved' }
    });

    expect(onApprovalResolved).toHaveBeenCalledWith(resolvedApproval);
  });

  it('registers the voice approval channel', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const controller = {
      resolve: vi.fn().mockResolvedValue({ message: 'ok' })
    };

    registerApprovalVoiceIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, controller);

    await expect(handlers.get('voice:resolve-approval')?.({}, { transcript: 'yes' })).resolves.toEqual({ message: 'ok' });
    expect(controller.resolve).toHaveBeenCalledWith({
      approvalId: undefined,
      transcript: 'yes',
      voiceTurnId: 'voice-unavailable'
    });
  });
});
