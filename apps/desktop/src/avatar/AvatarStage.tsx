import { useEffect, useRef } from 'react';
import spriteImageUrl from './bubbles_mvp.png';
import { bubblesSpriteMetadata, getAvatarPlayback, normalizeAvatarState, type AvatarState } from './animationCatalog';

interface AvatarStageProps {
  state: AvatarState;
}

export function AvatarStage({ state }: AvatarStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return undefined;
    }

    let destroyed = false;
    let cleanup: (() => void) | undefined;

    async function mountPixiAvatar() {
      const host = hostRef.current;

      if (!host) {
        return;
      }

      const { AnimatedSprite, Application, Assets, Rectangle, Texture } = await import('pixi.js');

      if (destroyed) {
        return;
      }

      const app = new Application();
      await app.init({
        width: 256,
        height: 256,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1
      });

      const baseTexture = await Assets.load(spriteImageUrl);
      const textures = avatarStatesToTextures(Texture, Rectangle, baseTexture, state);
      const sprite = new AnimatedSprite(textures);
      const animation = getAvatarPlayback(state);

      sprite.anchor.set(0.5);
      sprite.x = 128;
      sprite.y = 128;
      sprite.scale.set(1.8);
      sprite.animationSpeed = animation.fps / 60;
      sprite.loop = animation.loop;
      sprite.gotoAndPlay(0);

      host.replaceChildren(app.canvas);
      app.stage.addChild(sprite);

      cleanup = () => {
        app.destroy(true, { children: true, texture: false });
      };
    }

    void mountPixiAvatar();

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [state]);

  return (
    <div className="avatar-stage" data-testid="avatar-stage" ref={hostRef}>
      <div className="avatar-stage__fallback" aria-label={`Bubbles avatar ${state}`} />
    </div>
  );
}

function avatarStatesToTextures(
  TextureClass: typeof import('pixi.js').Texture,
  RectangleClass: typeof import('pixi.js').Rectangle,
  baseTexture: import('pixi.js').Texture,
  state: AvatarState
) {
  const normalizedState = normalizeAvatarState(state);
  const animation = getAvatarPlayback(normalizedState);
  const { frameSize } = bubblesSpriteMetadata;

  return Array.from({ length: animation.frames }, (_, index) => {
    const x = (animation.startColumn + index) * frameSize.width;
    const y = animation.row * frameSize.height;

    return new TextureClass({
      source: baseTexture.source,
      frame: new RectangleClass(x, y, frameSize.width, frameSize.height)
    });
  });
}
