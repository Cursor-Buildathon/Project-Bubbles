import { type ApprovalRequest, type ApprovalRisk } from '../shared/types.js';

export type ApprovalActionType =
  | ApprovalRequest['actionType']
  | 'web_search'
  | 'local_file_read'
  | 'email_read'
  | 'calendar_read';

export function classifyApprovalRisk(actionType: ApprovalActionType): ApprovalRisk {
  if (actionType === 'agent_file_create') {
    return 'medium';
  }

  if (
    actionType === 'web_search' ||
    actionType === 'local_file_read' ||
    actionType === 'email_read' ||
    actionType === 'calendar_read'
  ) {
    return 'low';
  }

  return 'high';
}
