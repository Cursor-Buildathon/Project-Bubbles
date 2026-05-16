import type { Mood } from "@bubbles/shared-types";
import type { Character } from "./Character";

interface MoodConfig {
	animation: string;
	loop: boolean;
	amplitudeScale: boolean;
	/** After a one-shot animation, fall back to this mood */
	fallback?: Mood;
}

const MOOD_MAP: Record<Mood, MoodConfig> = {
	idle: { animation: "idle", loop: true, amplitudeScale: false },
	listening: { animation: "review", loop: true, amplitudeScale: false },
	thinking: { animation: "waiting", loop: true, amplitudeScale: false },
	talking: { animation: "idle", loop: true, amplitudeScale: true },
	greeting: {
		animation: "waving",
		loop: false,
		amplitudeScale: false,
		fallback: "idle",
	},
	celebrating: {
		animation: "jumping",
		loop: false,
		amplitudeScale: false,
		fallback: "idle",
	},
	error: {
		animation: "failed",
		loop: false,
		amplitudeScale: false,
		fallback: "idle",
	},
};

export async function apply(character: Character, mood: string): Promise<void> {
	const cfg = MOOD_MAP[mood as Mood] ?? MOOD_MAP.idle;
	character.enableAmplitudeScale(cfg.amplitudeScale);

	const opts: { loop: boolean; onComplete?: () => void } = { loop: cfg.loop };
	if (!cfg.loop && cfg.fallback) {
		const fallback = cfg.fallback;
		opts.onComplete = () => apply(character, fallback);
	}

	await character.playAnimation(cfg.animation, opts);
}
