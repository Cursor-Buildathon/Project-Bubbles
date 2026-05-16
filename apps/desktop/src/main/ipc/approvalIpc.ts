import { ipcMain } from 'electron';
import { type ApprovalRequest, type ApprovalService } from '@bubbles/core';

interface RegisterApprovalIpcOptions {
  approvalService: ApprovalService;
  onApprovalResolved?: (approval: ApprovalRequest) => Promise<void> | void;
  onChanged?: () => Promise<void> | void;
}

export function registerApprovalIpc({ approvalService, onApprovalResolved, onChanged }: RegisterApprovalIpcOptions) {
  async function changed() {
    await onChanged?.();
    return approvalService.list();
  }

  ipcMain.handle('approvals:list', () => approvalService.list());
  ipcMain.handle('approvals:create', async (_event, input) => {
    await approvalService.create(input);
    return changed();
  });
  ipcMain.handle('approvals:approve', async (_event, id: string) => {
    const approval = await approvalService.approve(id);
    const approvals = await changed();

    void Promise.resolve(onApprovalResolved?.(approval)).catch((error) => {
      console.error('Approval follow-up failed:', error);
    });

    return approvals;
  });
  ipcMain.handle('approvals:deny', async (_event, id: string) => {
    await approvalService.deny(id);
    return changed();
  });
  ipcMain.handle('approvals:cancel', async (_event, id: string) => {
    await approvalService.cancel(id);
    return changed();
  });
}
