import spriteMetadata from './bubbles_mvp.json';

export type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'waiting_approval'
  | 'confused'
  | 'concerned'
  | 'celebrating'
  | 'sleeping';

export interface SpriteAnimation {
  row: number;
  startColumn: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export interface SpriteMetadata {
  image: string;
  frameSize: {
    width: number;
    height: number;
  };
  sheetSize: {
    columns: number;
    rows: number;
  };
  animations: Record<AvatarState, SpriteAnimation>;
}

export const avatarStates = [
  'idle',
  'listening',
  'thinking',
  'working',
  'waiting_approval',
  'confused',
  'concerned',
  'celebrating',
  'sleeping'
] as const satisfies readonly AvatarState[];

export const bubblesSpriteMetadata = spriteMetadata as SpriteMetadata;

export function normalizeAvatarState(state: unknown): AvatarState {
  return typeof state === 'string' && avatarStates.includes(state as AvatarState) ? (state as AvatarState) : 'idle';
}

export function getAvatarAnimation(state: unknown): SpriteAnimation {
  return bubblesSpriteMetadata.animations[normalizeAvatarState(state)];
}

export function getAvatarPlayback(state: unknown): SpriteAnimation {
  const normalizedState = normalizeAvatarState(state);
  const animation = getAvatarAnimation(normalizedState);

  return {
    ...animation,
    loop: normalizedState === 'celebrating' ? true : animation.loop
  };
}

export function validateSpriteMetadata(metadata: SpriteMetadata): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (metadata.frameSize.width !== 128 || metadata.frameSize.height !== 128) {
    errors.push('Sprite frames must be 128x128.');
  }

  if (metadata.sheetSize.columns !== 8 || metadata.sheetSize.rows !== 9) {
    errors.push('Sprite sheet must be 8 columns by 9 rows.');
  }

  for (const state of avatarStates) {
    const animation = metadata.animations[state];

    if (!animation) {
      errors.push(`Missing animation for ${state}.`);
      continue;
    }

    if (animation.row < 0 || animation.row >= metadata.sheetSize.rows) {
      errors.push(`${state} row is outside the sprite sheet.`);
    }

    if (animation.startColumn < 0 || animation.startColumn + animation.frames > metadata.sheetSize.columns) {
      errors.push(`${state} frames are outside the sprite sheet.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
