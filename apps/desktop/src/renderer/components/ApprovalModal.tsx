import { useState } from 'react';
import { AlertTriangle, Check, CircleSlash, X } from 'lucide-react';
import { type ApprovalRequest } from '@bubbles/core';

interface ApprovalModalProps {
  approvals: ApprovalRequest[];
  onApprove: (id: string) => Promise<void> | void;
  onCancel: (id: string) => Promise<void> | void;
  onDeny: (id: string) => Promise<void> | void;
}

export function ApprovalModal({ approvals, onApprove, onCancel, onDeny }: ApprovalModalProps) {
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');
  const [resolving, setResolving] = useState<{ id: string; decision: 'approve' | 'cancel' | 'deny' } | undefined>();

  if (!pendingApprovals.length) {
    return null;
  }

  async function resolveApproval(id: string, decision: 'approve' | 'cancel' | 'deny') {
    if (resolving) {
      return;
    }

    setResolving({ id, decision });

    try {
      const handler = decision === 'approve' ? onApprove : decision === 'deny' ? onDeny : onCancel;
      await handler(id);
    } catch {
      setResolving(undefined);
    }
  }

  return (
    <section className="approval-dialog-backdrop" aria-label="Pending approvals" data-testid="approval-modal">
      <div
        aria-busy={Boolean(resolving)}
        aria-labelledby="approval-dialog-title"
        aria-modal="true"
        className="approval-dialog"
        role="dialog"
      >
        <div className="approval-dialog__header">
          <div>
            <p className="eyebrow">
              <AlertTriangle size={14} aria-hidden="true" />
              Action needs approval
            </p>
            <h2 id="approval-dialog-title">Approval required</h2>
          </div>
          <span>{pendingApprovals.length} pending</span>
        </div>
        <div className="approval-stack">
          {pendingApprovals.map((approval) => {
            const isResolving = resolving?.id === approval.id;
            const anyResolving = Boolean(resolving);

            return (
              <article className={`approval-card approval-card--${approval.risk}`} key={approval.id}>
                <div className="approval-card__header">
                  <div>
                    <p className="eyebrow">
                      <AlertTriangle size={14} aria-hidden="true" />
                      {approval.risk} risk
                    </p>
                    <h3>{approval.title}</h3>
                  </div>
                  <button
                    aria-label={`Cancel ${approval.title}`}
                    className="icon-button"
                    disabled={anyResolving}
                    onClick={() => void resolveApproval(approval.id, 'cancel')}
                    type="button"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <p>{approval.explanation}</p>
                <pre className="approval-preview">{formatPreview(approval.preview)}</pre>
                {isResolving ? (
                  <p className="approval-card__status" role="status">
                    {resolving.decision === 'approve' ? 'Approving...' : resolving.decision === 'deny' ? 'Denying...' : 'Cancelling...'}
                  </p>
                ) : null}
                <div className="approval-actions">
                  <button
                    aria-label={`Deny ${approval.title}`}
                    className="approval-button approval-button--deny"
                    disabled={anyResolving}
                    onClick={() => void resolveApproval(approval.id, 'deny')}
                    type="button"
                  >
                    <CircleSlash size={16} aria-hidden="true" />
                    <span>Deny</span>
                  </button>
                  <button
                    aria-label={`Approve ${approval.title}`}
                    className="approval-button approval-button--approve"
                    disabled={anyResolving}
                    onClick={() => void resolveApproval(approval.id, 'approve')}
                    type="button"
                  >
                    <Check size={16} aria-hidden="true" />
                    <span>Approve</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function formatPreview(preview: Record<string, unknown>) {
  return JSON.stringify(preview, null, 2);
}
