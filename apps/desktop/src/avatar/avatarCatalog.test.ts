import spriteMetadata from './bubbles_mvp.json';
import { avatarStates, getAvatarPlayback, normalizeAvatarState, validateSpriteMetadata } from './animationCatalog';

describe('Bubbles sprite metadata', () => {
  it('loads all required Phase 1 avatar states', () => {
    const validation = validateSpriteMetadata(spriteMetadata);

    expect(validation.valid).toBe(true);
    expect(Object.keys(spriteMetadata.animations).sort()).toEqual([...avatarStates].sort());
  });

  it('uses the generated 128px frame and 8x9 sheet dimensions', () => {
    expect(spriteMetadata.frameSize).toEqual({ width: 128, height: 128 });
    expect(spriteMetadata.sheetSize).toEqual({ columns: 8, rows: 9 });
  });

  it('falls back to idle for unknown avatar states', () => {
    expect(normalizeAvatarState('not_real')).toBe('idle');
  });

  it('loops the celebrating playback while that state is active', () => {
    expect(getAvatarPlayback('celebrating').loop).toBe(true);
  });
});
