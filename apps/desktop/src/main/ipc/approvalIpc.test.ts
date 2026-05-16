import { describe, expect, it, vi } from 'vitest';
import { registerApprovalIpc } from './approvalIpc.js';

const mocks = vi.hoisted(() => ({
  handle: vi.fn()
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.handle
  }
}));

describe('registerApprovalIpc', () => {
  it('returns approved state before running slow approval follow-up work', async () => {
    const approval = {
      id: 'approval-1',
      status: 'approved'
    };
    const approvalService = {
      approve: vi.fn().mockResolvedValue(approval),
      cancel: vi.fn(),
      create: vi.fn(),
      deny: vi.fn(),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue([approval]),
      requireApproved: vi.fn()
    };
    let resolveFollowUp: (() => void) | undefined;
    const onApprovalResolved = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFollowUp = resolve;
        })
    );

    registerApprovalIpc({ approvalService, onApprovalResolved });
    const approveHandler = ipcHandler('approvals:approve');

    await expect(approveHandler({}, 'approval-1')).resolves.toEqual([approval]);
    expect(onApprovalResolved).toHaveBeenCalledWith(approval);
    resolveFollowUp?.();
  });
});

function ipcHandler(channel: string) {
  const handler = mocks.handle.mock.calls.find(([candidate]) => candidate === channel)?.[1];

  if (!handler) {
    throw new Error(`Missing IPC handler for ${channel}.`);
  }

  return handler;
}
