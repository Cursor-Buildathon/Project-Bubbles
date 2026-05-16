import { createLogger } from "@bubbles/shared-logger";
import { IPC_CHANNELS } from "@bubbles/shared-types";
import type { WebContents } from "electron";

const log = createLogger("audio");

/**
 * Send MP3 audio bytes to the renderer for Web Audio API playback.
 *
 * Audio is played in the renderer (HTML5 Audio element) because Visual Studio
 * Build Tools are required to compile `node-speaker` on Windows.
 * Phase 3 can switch to main-process audio once the build environment supports it.
 *
 * The renderer handles amplitude events and sends `v1:audio:amplitude` back.
 */
export function playAudio(sender: WebContents, mp3Buffer: Buffer): void {
	log.info({ event: "audio-send", bytes: mp3Buffer.length });
	sender.send(IPC_CHANNELS.AUDIO_PLAY, {
		data: Array.from(mp3Buffer),
		mimeType: "audio/mpeg",
	});
}
