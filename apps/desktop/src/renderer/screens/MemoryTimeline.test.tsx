import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryTimeline } from './MemoryTimeline';
import { type MemoryItem, type TimelineEvent } from '@bubbles/core';

describe('MemoryTimeline', () => {
  it('shows memories and timeline events with a clear action', () => {
    const onClearMemory = vi.fn();

    render(
      <MemoryTimeline
        memories={[
          {
            id: 'mem-1',
            type: 'user_preference',
            content: 'Prefers short plans.',
            tags: ['style'],
            importance: 4,
            createdAt: '2026-05-14T00:00:00.000Z',
            updatedAt: '2026-05-14T00:00:00.000Z'
          } satisfies MemoryItem
        ]}
        onClearMemory={onClearMemory}
        timelineEvents={[
          {
            id: 'evt-1',
            type: 'agent_created',
            title: 'Agent created',
            summary: 'Research Helper was born.',
            metadata: {},
            createdAt: '2026-05-14T00:00:00.000Z'
          } satisfies TimelineEvent
        ]}
      />
    );

    expect(screen.getByText('Prefers short plans.')).toBeInTheDocument();
    expect(screen.getByText('Research Helper was born.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear memory' }));
    expect(onClearMemory).toHaveBeenCalled();
  });
});
