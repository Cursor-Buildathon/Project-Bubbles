import { describe, expect, it } from 'vitest';
import { detectAffect } from './affectDetector.js';

describe('detectAffect', () => {
  it('detects urgent requests with focused speech styling', () => {
    expect(detectAffect({ text: 'This is urgent, I need help before the meeting starts.' })).toMatchObject({
      primary: 'urgent',
      confidence: 0.82,
      urgency: 3,
      ttsStyle: 'focused'
    });
  });

  it('detects confused requests with encouraging speech styling', () => {
    expect(detectAffect({ text: "I'm confused and not sure what to do next." })).toMatchObject({
      primary: 'confused',
      urgency: 1,
      ttsStyle: 'encouraging'
    });
  });

  it('defaults to neutral for ordinary turns', () => {
    expect(detectAffect({ text: 'Help me plan my day.' })).toEqual({
      primary: 'neutral',
      confidence: 0.6,
      urgency: 0,
      evidence: [],
      ttsStyle: 'warm'
    });
  });
});
