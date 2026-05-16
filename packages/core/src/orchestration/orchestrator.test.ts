import { describe, expect, it } from 'vitest';
import { mapTaskEventToAvatarState } from './orchestrator.js';

describe('mapTaskEventToAvatarState', () => {
  it('maps direct task lifecycle events to avatar states', () => {
    expect(mapTaskEventToAvatarState({ type: 'task.received' })).toBe('thinking');
    expect(mapTaskEventToAvatarState({ type: 'task.status', payload: { status: 'running' } })).toBe('working');
    expect(mapTaskEventToAvatarState({ type: 'task.partial_output' })).toBe('working');
    expect(mapTaskEventToAvatarState({ type: 'approval.required' })).toBe('waiting_approval');
    expect(mapTaskEventToAvatarState({ type: 'task.status', payload: { status: 'missing_info' } })).toBe('confused');
    expect(mapTaskEventToAvatarState({ type: 'task.error' })).toBe('concerned');
    expect(mapTaskEventToAvatarState({ type: 'task.result' })).toBe('celebrating');
    expect(mapTaskEventToAvatarState({ type: 'task.cancelled' })).toBe('idle');
  });
});
