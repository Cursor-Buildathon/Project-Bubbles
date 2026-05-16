import { Ban, Clock3 } from 'lucide-react';
import { type CliEvent } from '@bubbles/core';

interface TaskDrawerProps {
  activeTaskId: string | null;
  events: CliEvent[];
  onCancelTask: (taskId: string) => void;
}

export function TaskDrawer({ activeTaskId, events, onCancelTask }: TaskDrawerProps) {
  return (
    <section className="workspace-card task-drawer" data-testid="task-drawer" aria-label="Task drawer">
      <div className="task-drawer__header">
        <h2>
          <Clock3 size={16} aria-hidden="true" />
          Task Drawer
        </h2>
        {activeTaskId ? (
          <button className="icon-button" type="button" aria-label="Cancel active task" onClick={() => onCancelTask(activeTaskId)}>
            <Ban size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {events.length > 0 ? (
        <ul className="task-event-list">
          {events.map((event, index) => (
            <li className={`task-event task-event--${event.type.replace('.', '-')}`} key={`${event.taskId}-${event.type}-${index}`}>
              <span className="task-event__type">{event.type}</span>
              <span className="task-event__text">{formatEventPayload(event)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No active CLI task yet.</p>
      )}
    </section>
  );
}

function formatEventPayload(event: CliEvent) {
  const text =
    stringPayload(event.payload.errorMessage) ??
    stringPayload(event.payload.text) ??
    stringPayload(event.payload.error) ??
    stringPayload(event.payload.status) ??
    stringPayload(event.payload.reason) ??
    stringPayload(event.payload.signal);
  const hint = stringPayload(event.payload.hint);

  return [text ?? `Task ${event.taskId}`, hint].filter(Boolean).join('\n');
}

function stringPayload(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
