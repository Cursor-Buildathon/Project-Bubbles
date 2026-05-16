import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    mocks.handle.mockClear();
  });

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

  it('runs follow-up work for denied and cancelled approvals', async () => {
    const deniedApproval = {
      id: 'approval-denied',
      status: 'denied'
    };
    const cancelledApproval = {
      id: 'approval-cancelled',
      status: 'cancelled'
    };
    const approvalService = {
      approve: vi.fn(),
      cancel: vi.fn().mockResolvedValue(cancelledApproval),
      create: vi.fn(),
      deny: vi.fn().mockResolvedValue(deniedApproval),
      get: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      requireApproved: vi.fn()
    };
    const onApprovalResolved = vi.fn();

    registerApprovalIpc({ approvalService, onApprovalResolved });

    await expect(ipcHandler('approvals:deny')({}, 'approval-denied')).resolves.toEqual([]);
    await expect(ipcHandler('approvals:cancel')({}, 'approval-cancelled')).resolves.toEqual([]);
    expect(onApprovalResolved).toHaveBeenCalledWith(deniedApproval);
    expect(onApprovalResolved).toHaveBeenCalledWith(cancelledApproval);
  });
});

function ipcHandler(channel: string) {
  const handler = mocks.handle.mock.calls.find(([candidate]) => candidate === channel)?.[1];

  if (!handler) {
    throw new Error(`Missing IPC handler for ${channel}.`);
  }

  return handler;
}
