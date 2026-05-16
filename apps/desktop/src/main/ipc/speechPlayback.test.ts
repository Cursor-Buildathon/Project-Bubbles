import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createNativeSpeechPlayback } from './speechPlayback.js';

class FakeSpeechProcess extends EventEmitter {
  readonly kill = vi.fn(() => true);
}

describe('createNativeSpeechPlayback', () => {
  it('resolves when macOS speech exits cleanly', async () => {
    const process = new FakeSpeechProcess();
    const playback = createNativeSpeechPlayback({ runSay: () => process });
    const result = playback.speak({ text: 'Hello there.', ttsId: 'tts-1' });

    process.emit('exit', 0, null);

    await expect(result).resolves.toEqual({ ok: true, ttsId: 'tts-1' });
  });

  it('stops the active speech process for barge-in', () => {
    const process = new FakeSpeechProcess();
    const playback = createNativeSpeechPlayback({ runSay: () => process });

    void playback.speak({ text: 'A longer spoken reply.', ttsId: 'tts-2' });

    expect(playback.stop({ ttsId: 'tts-2' })).toEqual({ ok: true, ttsId: 'tts-2' });
    expect(process.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('reports launch failures without throwing', async () => {
    const process = new FakeSpeechProcess();
    const playback = createNativeSpeechPlayback({ runSay: () => process });
    const result = playback.speak({ text: 'Hello there.', ttsId: 'tts-3' });

    process.emit('error', new Error('say failed'));

    await expect(result).resolves.toEqual({ ok: false, ttsId: 'tts-3', error: 'say failed' });
  });
});
