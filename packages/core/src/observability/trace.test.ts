import { describe, expect, it, vi } from 'vitest';
import { createTrace, createTraceEvent, withTrace, type TraceEvent } from './trace.js';

describe('trace observability', () => {
  it('creates redacted structured events with correlation ids', () => {
    const event = createTraceEvent({
      approvalId: 'approval-1',
      fields: {
        command: 'external-tool --api-key sk-cp-secret',
        nested: { authorization: 'Bearer sk-abcdefghijklmnop' },
        textLength: 42
      },
      name: 'approval.resolved',
      taskId: 'task-1',
      traceId: 'trace-1',
      voiceTurnId: 'voice-1'
    });

    expect(event).toMatchObject({
      approvalId: 'approval-1',
      fields: {
        command: 'external-tool --api-key [REDACTED]',
        nested: { authorization: 'Bearer [REDACTED]' },
        textLength: 42
      },
      name: 'approval.resolved',
      taskId: 'task-1',
      traceId: 'trace-1',
      voiceTurnId: 'voice-1'
    });
    expect(JSON.stringify(event)).not.toContain('sk-cp-secret');
  });

  it('logs start and redacted failures around traced operations', async () => {
    const events: TraceEvent[] = [];
    const logger = vi.fn((event: TraceEvent) => {
      events.push(event);
    });
    const trace = createTrace({ traceId: 'trace-2', taskId: 'task-2' });

    await expect(
      withTrace(
        trace,
        'task.run',
        async () => {
          throw new Error('failed with sk-cp-runtime-secret');
        },
        logger
      )
    ).rejects.toThrow('sk-cp-runtime-secret');

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ name: 'task.run.started', taskId: 'task-2', traceId: 'trace-2' });
    expect(events[1]).toMatchObject({
      fields: { error: 'failed with [REDACTED]' },
      name: 'task.run.failed',
      taskId: 'task-2',
      traceId: 'trace-2'
    });
  });
});
