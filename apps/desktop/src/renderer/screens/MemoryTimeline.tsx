import { Clock3, Trash2 } from 'lucide-react';
import { type MemoryItem, type TimelineEvent } from '@bubbles/core';

interface MemoryTimelineProps {
  memories: MemoryItem[];
  onClearMemory: () => void;
  timelineEvents: TimelineEvent[];
}

export function MemoryTimeline({ memories, onClearMemory, timelineEvents }: MemoryTimelineProps) {
  return (
    <section className="memory-timeline" data-testid="memory-timeline" aria-label="Memory timeline">
      <header className="memory-timeline__header">
        <h2>
          <Clock3 size={16} aria-hidden="true" />
          Memory
        </h2>
        <button className="icon-button" type="button" aria-label="Clear memory" onClick={onClearMemory}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="memory-timeline__section">
        <h3>Saved</h3>
        {memories.length ? (
          memories.map((memory) => (
            <article className="memory-row" key={memory.id}>
              <strong>{memory.type.replace('_', ' ')}</strong>
              <p>{memory.content}</p>
            </article>
          ))
        ) : (
          <p className="empty-text">No saved memories yet.</p>
        )}
      </div>

      <div className="memory-timeline__section">
        <h3>Timeline</h3>
        {timelineEvents.length ? (
          timelineEvents.map((event) => (
            <article className="memory-row" key={event.id}>
              <strong>{event.title}</strong>
              <p>{event.summary}</p>
            </article>
          ))
        ) : (
          <p className="empty-text">No timeline events yet.</p>
        )}
      </div>
    </section>
  );
}
