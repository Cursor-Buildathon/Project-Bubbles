import { describe, expect, it } from 'vitest';
import { shouldUseMiniMaxMediaFixture } from './mediaFixtureMode.js';

describe('shouldUseMiniMaxMediaFixture', () => {
  it('uses real MiniMax media generation by default', () => {
    expect(shouldUseMiniMaxMediaFixture({})).toBe(false);
  });

  it('enables fixture media only when explicitly requested', () => {
    expect(shouldUseMiniMaxMediaFixture({ BUBBLES_MINIMAX_MEDIA_FIXTURE: 'true' })).toBe(true);
    expect(shouldUseMiniMaxMediaFixture({ BUBBLES_MINIMAX_MEDIA_FIXTURE: '1' })).toBe(true);
  });

  it('keeps fixture media disabled for false-like values', () => {
    expect(shouldUseMiniMaxMediaFixture({ BUBBLES_MINIMAX_MEDIA_FIXTURE: 'false' })).toBe(false);
    expect(shouldUseMiniMaxMediaFixture({ BUBBLES_MINIMAX_MEDIA_FIXTURE: '0' })).toBe(false);
  });
});
