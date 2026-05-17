import { type ApprovalRequest, type ApprovalRisk } from '../shared/types.js';

export type ApprovalActionType =
  | ApprovalRequest['actionType']
  | 'tavily_research'
  | 'local_file_read';

export function classifyApprovalRisk(actionType: ApprovalActionType): ApprovalRisk {
  if (actionType === 'agent_file_create') {
    return 'medium';
  }

  if (
    actionType === 'tavily_research' ||
    actionType === 'local_file_read'
  ) {
    return 'low';
  }

  return 'high';
}
