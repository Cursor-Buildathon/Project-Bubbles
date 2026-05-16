import { describe, expect, it } from 'vitest';
import { createTtsService } from './ttsService.js';

describe('createTtsService', () => {
  it('does not generate audio while muted', async () => {
    const service = createTtsService({
      muted: true,
      synthesize: async () => {
        throw new Error('should not be called');
      }
    });

    await expect(service.speak('Hello', 'warm')).resolves.toEqual({ ok: false, muted: true });
  });

  it('returns generated audio when voice output is enabled', async () => {
    const service = createTtsService({
      muted: false,
      synthesize: async (text, voiceStyle) => ({
        audioPath: '/tmp/voice.mp3',
        mimeType: 'audio/mpeg',
        text,
        voiceStyle
      })
    });

    await expect(service.speak('Hello', 'warm')).resolves.toEqual({
      ok: true,
      audioId: 'tts-voice-mp3',
      audioPath: '/tmp/voice.mp3',
      mimeType: 'audio/mpeg',
      text: 'Hello',
      voiceStyle: 'warm'
    });
  });

  it('falls back to an audio/mpeg mime type when the provider omits one', async () => {
    const service = createTtsService({
      muted: false,
      synthesize: async () => ({ audioPath: '/tmp/spoken-response' })
    });

    await expect(service.speak('Hello', 'warm')).resolves.toMatchObject({
      ok: true,
      audioId: 'tts-spoken-response',
      audioPath: '/tmp/spoken-response',
      mimeType: 'audio/mpeg'
    });
  });
});
