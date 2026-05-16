import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ApprovalRequest } from '@bubbles/core';
import { ApprovalModal } from './ApprovalModal';

describe('ApprovalModal', () => {
  it('shows a redacted approval preview and resolves the decision', () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    const onCancel = vi.fn();

    render(
      <ApprovalModal
        approvals={[
          {
            id: 'approval-1',
            taskId: 'task-1',
            agentId: 'general-assistant',
            actionType: 'external_data_send',
            risk: 'high',
            title: 'Send external data',
            explanation: 'Bubbles wants to send this payload.',
            preview: {
              to: 'friend@example.com',
              body: 'Token [REDACTED]'
            },
            status: 'pending',
            createdAt: '2026-05-14T00:00:00.000Z'
          } satisfies ApprovalRequest
        ]}
        onApprove={onApprove}
        onCancel={onCancel}
        onDeny={onDeny}
      />
    );

    expect(screen.getByText('Send external data')).toBeInTheDocument();
    expect(screen.getByText('high risk')).toBeInTheDocument();
    expect(screen.getByText(/friend@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/REDACTED/)).toBeInTheDocument();
    expect(screen.getByText('Voice approval: say "approve", "deny", or "cancel" while voice input is listening.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve Send external data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deny Send external data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Send external data' }));

    expect(onApprove).toHaveBeenCalledWith('approval-1');
    expect(onDeny).toHaveBeenCalledWith('approval-1');
    expect(onCancel).toHaveBeenCalledWith('approval-1');
  });

  it('renders nothing when no approvals are pending', () => {
    const { container } = render(
      <ApprovalModal approvals={[]} onApprove={vi.fn()} onCancel={vi.fn()} onDeny={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
