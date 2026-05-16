import { describe, expect, it } from 'vitest';
import { mapCliEventToAvatarState } from './orchestrator.js';

describe('mapCliEventToAvatarState', () => {
  it('maps CLI lifecycle events to avatar states', () => {
    expect(mapCliEventToAvatarState({ type: 'task.received' })).toBe('thinking');
    expect(mapCliEventToAvatarState({ type: 'task.status', payload: { status: 'running' } })).toBe('working');
    expect(mapCliEventToAvatarState({ type: 'task.partial_output' })).toBe('working');
    expect(mapCliEventToAvatarState({ type: 'approval.required' })).toBe('waiting_approval');
    expect(mapCliEventToAvatarState({ type: 'task.status', payload: { status: 'missing_info' } })).toBe('confused');
    expect(mapCliEventToAvatarState({ type: 'task.error' })).toBe('concerned');
    expect(mapCliEventToAvatarState({ type: 'task.result' })).toBe('celebrating');
    expect(mapCliEventToAvatarState({ type: 'task.cancelled' })).toBe('idle');
  });
});
