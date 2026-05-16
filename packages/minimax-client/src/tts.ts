import { getApiKey } from "./auth";
import { withBackoff } from "./backoff";
import { fakeSynthesize, isTestMode } from "./test-mode";

const TTS_ENDPOINT = "https://api.minimaxi.chat/v1/t2a_v2";

export interface SynthesizeOpts {
	text: string;
	/** MiniMax voice ID. Default: "male-qn-qingse" */
	voiceId?: string;
	turnId: string;
	/** Speech speed multiplier. Default: 1.0 */
	speed?: number;
	/** Audio format. Default: "mp3" */
	format?: "mp3" | "pcm" | "flac";
}

/**
 * Synthesize text to speech via MiniMax Speech-02-Turbo.
 * Returns the full MP3 buffer (Phase 2 buffers the whole reply;
 * Phase 3 will switch to streaming).
 */
export async function synthesize(opts: SynthesizeOpts): Promise<Buffer> {
	if (isTestMode()) {
		return fakeSynthesize({ text: opts.text, turnId: opts.turnId });
	}

	const apiKey = getApiKey();

	const response = await withBackoff(async () => {
		const res = await fetch(TTS_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"x-bubbles-turn-id": opts.turnId,
			},
			body: JSON.stringify({
				model: "speech-02-turbo",
				text: opts.text,
				voice_setting: {
					voice_id: opts.voiceId ?? "male-qn-qingse",
					speed: opts.speed ?? 1.0,
					format: opts.format ?? "mp3",
				},
			}),
		});
		if (!res.ok) {
			const err = new Error(
				`MiniMax TTS error: ${res.status} ${res.statusText}`,
			) as Error & { status: number };
			err.status = res.status;
			throw err;
		}
		return res;
	});

	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}
