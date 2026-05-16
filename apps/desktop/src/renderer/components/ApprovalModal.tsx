import { AlertTriangle, Check, CircleSlash, X } from 'lucide-react';
import { type ApprovalRequest } from '@bubbles/core';

interface ApprovalModalProps {
  approvals: ApprovalRequest[];
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
  onDeny: (id: string) => void;
}

export function ApprovalModal({ approvals, onApprove, onCancel, onDeny }: ApprovalModalProps) {
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');

  if (!pendingApprovals.length) {
    return null;
  }

  return (
    <section className="approval-stack" aria-label="Pending approvals" data-testid="approval-modal">
      {pendingApprovals.map((approval) => (
        <article className={`approval-card approval-card--${approval.risk}`} key={approval.id}>
          <div className="approval-card__header">
            <div>
              <p className="eyebrow">
                <AlertTriangle size={14} aria-hidden="true" />
                {approval.risk} risk
              </p>
              <h2>{approval.title}</h2>
            </div>
            <button
              aria-label={`Cancel ${approval.title}`}
              className="icon-button"
              onClick={() => onCancel(approval.id)}
              type="button"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p>{approval.explanation}</p>
          <pre className="approval-preview">{formatPreview(approval.preview)}</pre>
          <p className="approval-card__voice-hint">
            Voice approval: say "approve", "deny", or "cancel" while voice input is listening.
          </p>
          <div className="approval-actions">
            <button
              aria-label={`Deny ${approval.title}`}
              className="approval-button approval-button--deny"
              onClick={() => onDeny(approval.id)}
              type="button"
            >
              <CircleSlash size={16} aria-hidden="true" />
              <span>Deny</span>
            </button>
            <button
              aria-label={`Approve ${approval.title}`}
              className="approval-button approval-button--approve"
              onClick={() => onApprove(approval.id)}
              type="button"
            >
              <Check size={16} aria-hidden="true" />
              <span>Approve</span>
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function formatPreview(preview: Record<string, unknown>) {
  return JSON.stringify(preview, null, 2);
}
