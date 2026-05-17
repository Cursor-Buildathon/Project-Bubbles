import { type ApprovalRequest, type VoiceApprovalResolution } from '@bubbles/core';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

interface IpcMainLike {
  handle: (channel: string, handler: IpcHandler) => void;
}

interface ApprovalVoiceResolver {
  resolve: (input: ResolveApprovalVoiceInput) => Promise<VoiceApprovalResolution>;
}

interface ApprovalVoiceIpcControllerOptions {
  resolver: ApprovalVoiceResolver;
  onApprovalResolved?: (approval: ApprovalRequest) => Promise<void> | void;
}

interface ResolveApprovalVoiceInput {
  approvalId?: string;
  voiceTurnId: string;
  transcript: string;
}

export function createApprovalVoiceIpcController({ resolver, onApprovalResolved }: ApprovalVoiceIpcControllerOptions) {
  return {
    async resolve(input: ResolveApprovalVoiceInput) {
      const result = await resolver.resolve(input);

      if (result.resolvedApproval) {
        await onApprovalResolved?.(result.resolvedApproval);
      }

      return result;
    }
  };
}

export function registerApprovalVoiceIpc(
  ipcMain: IpcMainLike,
  controller: ReturnType<typeof createApprovalVoiceIpcController>
) {
  ipcMain.handle('voice:resolve-approval', (_event, input) => controller.resolve(parseResolveApprovalVoiceInput(input)));
}

function parseResolveApprovalVoiceInput(input: unknown): ResolveApprovalVoiceInput {
  if (!input || typeof input !== 'object') {
    return { voiceTurnId: 'voice-unavailable', transcript: '' };
  }

  const record = input as Record<string, unknown>;
  return {
    approvalId: typeof record.approvalId === 'string' ? record.approvalId : undefined,
    voiceTurnId: typeof record.voiceTurnId === 'string' ? record.voiceTurnId : 'voice-unavailable',
    transcript: typeof record.transcript === 'string' ? record.transcript : ''
  };
}
