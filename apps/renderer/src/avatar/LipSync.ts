import type { Character } from "./Character";

export class LipSync {
	private character: Character;
	private unsub: (() => void) | null = null;
	private smoothed = 0;

	constructor(character: Character) {
		this.character = character;
	}

	start(): void {
		if (!window.bubbles?.audio.onAmplitude) return;
		this.unsub = window.bubbles.audio.onAmplitude((payload) => {
			// Low-pass smooth to avoid jitter
			this.smoothed = this.smoothed * 0.7 + payload.rms * 0.3;
			this.character.setAmplitudeScale(this.smoothed);
		});
	}

	stop(): void {
		this.unsub?.();
		this.unsub = null;
		this.smoothed = 0;
	}
}
