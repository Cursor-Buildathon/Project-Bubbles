import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskDrawer } from './TaskDrawer';
import { type CliEvent } from '@bubbles/core';

describe('TaskDrawer', () => {
  it('renders live task events and cancels the active task', () => {
    const onCancelTask = vi.fn();

    render(
      <TaskDrawer
        activeTaskId="task-1"
        events={[
          createEvent('task.received', { activeAgentId: 'general-assistant' }),
          createEvent('task.partial_output', { stream: 'stdout', text: 'Working on it' }),
          createEvent('task.result', { exitCode: 0 })
        ]}
        onCancelTask={onCancelTask}
      />
    );

    expect(screen.getByText('task.received')).toBeInTheDocument();
    expect(screen.getByText('Working on it')).toBeInTheDocument();
    expect(screen.getByText('task.result')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel active task' }));

    expect(onCancelTask).toHaveBeenCalledWith('task-1');
  });

  it('shows errors and cancelled states without a cancel button', () => {
    render(
      <TaskDrawer
        activeTaskId={null}
        events={[createEvent('task.error', { error: 'Command failed' }), createEvent('task.cancelled', { signal: 'SIGTERM' })]}
        onCancelTask={vi.fn()}
      />
    );

    expect(screen.getByText('Command failed')).toBeInTheDocument();
    expect(screen.getByText('task.cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel active task' })).not.toBeInTheDocument();
  });

  it('shows normalized MiniMax network messages and hints', () => {
    render(
      <TaskDrawer
        activeTaskId={null}
        events={[
          createEvent('task.error', {
            category: 'network',
            errorMessage:
              'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.',
            hint: 'To use a proxy: set HTTPS_PROXY env var.'
          })
        ]}
        onCancelTask={vi.fn()}
      />
    );

    expect(screen.getByText(/MiniMax CLI cannot reach the network right now/)).toBeInTheDocument();
    expect(screen.getByText(/HTTPS_PROXY/)).toBeInTheDocument();
  });
});

function createEvent(type: CliEvent['type'], payload: Record<string, unknown>): CliEvent {
  return {
    taskId: 'task-1',
    type,
    payload,
    createdAt: '2026-05-14T10:00:00.000Z'
  };
}
