import type { Application } from "pixi.js";
import { AnimatedSprite } from "pixi.js";
import type { LoadedAtlas } from "./SpriteAtlasLoader";
import { loadAtlas } from "./SpriteAtlasLoader";

export class Character {
	private sprite: AnimatedSprite | null = null;
	private app: Application;
	private atlasUrl: string;
	private atlas: LoadedAtlas | null = null;
	private amplitudeEnabled = false;
	private baseScaleY = 1;

	constructor(app: Application, atlasUrl: string) {
		this.app = app;
		this.atlasUrl = atlasUrl;
	}

	async load(): Promise<void> {
		this.atlas = await loadAtlas(this.atlasUrl);
		await this.playAnimation("idle");
	}

	async playAnimation(
		name: string,
		opts: { loop?: boolean; onComplete?: () => void } = {},
	): Promise<void> {
		if (!this.atlas) return;

		const frames = this.atlas.frames.get(name);
		if (!frames || frames.length === 0) return;

		const def = this.atlas.manifest.animations[name];
		const loop = opts.loop ?? true;

		if (this.sprite) {
			this.app.stage.removeChild(this.sprite);
			this.sprite.destroy();
		}

		const sprite = new AnimatedSprite(frames);
		sprite.animationSpeed = 60 / (1000 / def.frameDurationMs) / 60;
		sprite.loop = loop;
		sprite.anchor.set(0.5, 1.0);

		const { width, height } = this.app.screen;
		sprite.x = width / 2;
		sprite.y = height;

		const scale = Math.min(
			(width * 0.9) / frames[0].width,
			(height * 0.9) / frames[0].height,
		);
		sprite.scale.set(scale);
		this.baseScaleY = scale;

		if (!loop && opts.onComplete) {
			sprite.onComplete = opts.onComplete;
		}

		this.app.stage.addChild(sprite);
		this.sprite = sprite;
		sprite.play();
	}

	setTint(tint: number): void {
		if (this.sprite) {
			this.sprite.tint = tint;
		}
	}

	enableAmplitudeScale(enabled: boolean): void {
		this.amplitudeEnabled = enabled;
		if (!enabled && this.sprite) {
			this.sprite.scale.y = this.baseScaleY;
		}
	}

	setAmplitudeScale(rms: number): void {
		if (!this.amplitudeEnabled || !this.sprite) return;
		const clamped = Math.min(1, Math.max(0, rms));
		this.sprite.scale.y = this.baseScaleY * (1 + clamped * 0.15);
	}

	async setMood(mood: string): Promise<void> {
		const { apply } = await import("./MoodController");
		await apply(this, mood);
	}
}
