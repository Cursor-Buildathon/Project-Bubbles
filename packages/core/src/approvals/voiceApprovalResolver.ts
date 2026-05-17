import { type ApprovalRequest } from '../shared/types.js';
import { classifyApprovalVoiceDecision, createApprovalVoiceFallback } from '../voice/approvalVoiceDecision.js';
import { type ApprovalVoiceDecision } from '../voice/voiceTypes.js';

interface VoiceApprovalService {
  approve: (id: string) => Promise<ApprovalRequest>;
  cancel: (id: string) => Promise<ApprovalRequest>;
  deny: (id: string) => Promise<ApprovalRequest>;
  list: () => Promise<ApprovalRequest[]>;
}

interface VoiceApprovalResolverOptions {
  approvalService: VoiceApprovalService;
  enabled: boolean;
}

interface ResolveVoiceApprovalInput {
  approvalId?: string;
  voiceTurnId: string;
  transcript: string;
}

export interface VoiceApprovalResolution {
  decision: ApprovalVoiceDecision;
  resolvedApproval?: ApprovalRequest;
  message: string;
  fallbackRequired: boolean;
  attemptCount: number;
}

export function createVoiceApprovalResolver({ approvalService, enabled }: VoiceApprovalResolverOptions) {
  const attemptsByApproval = new Map<string, number>();

  async function findPendingApproval(approvalId: string | undefined) {
    const approvals = await approvalService.list();
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');

    if (approvalId) {
      return pendingApprovals.find((approval) => approval.id === approvalId);
    }

    return pendingApprovals[0];
  }

  return {
    async resolve(input: ResolveVoiceApprovalInput): Promise<VoiceApprovalResolution> {
      const approval = await findPendingApproval(input.approvalId);
      const approvalId = approval?.id ?? input.approvalId ?? 'approval-unavailable';
      const decision = classifyApprovalVoiceDecision({
        approvalId,
        voiceTurnId: input.voiceTurnId,
        transcript: input.transcript
      });

      if (!enabled) {
        return {
          decision,
          message: 'Voice approvals are off. Please use the approval buttons in chat.',
          fallbackRequired: true,
          attemptCount: attemptsByApproval.get(approvalId) ?? 0
        };
      }

      if (!approval) {
        return {
          decision: { ...decision, decision: 'unclear' },
          message: "There's nothing waiting for approval.",
          fallbackRequired: true,
          attemptCount: 0
        };
      }

      if (decision.decision === 'approved') {
        attemptsByApproval.delete(approval.id);
        const resolvedApproval = await approvalService.approve(approval.id);
        return {
          decision,
          resolvedApproval,
          message: `${approval.title} was approved.`,
          fallbackRequired: false,
          attemptCount: 0
        };
      }

      if (decision.decision === 'denied') {
        attemptsByApproval.delete(approval.id);
        const resolvedApproval = await approvalService.deny(approval.id);
        return {
          decision,
          resolvedApproval,
          message: `${approval.title} was denied.`,
          fallbackRequired: false,
          attemptCount: 0
        };
      }

      if (decision.decision === 'cancelled') {
        attemptsByApproval.delete(approval.id);
        const resolvedApproval = await approvalService.cancel(approval.id);
        return {
          decision,
          resolvedApproval,
          message: `${approval.title} was cancelled.`,
          fallbackRequired: false,
          attemptCount: 0
        };
      }

      const attemptCount = (attemptsByApproval.get(approval.id) ?? 0) + 1;
      attemptsByApproval.set(approval.id, attemptCount);

      return {
        decision,
        message: createApprovalVoiceFallback({ approvalTitle: approval.title, attemptCount }),
        fallbackRequired: attemptCount >= 2,
        attemptCount
      };
    }
  };
}
