import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMiniMaxTtsService, createTtsService } from './ttsService.js';

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'bubbles-tts-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

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

describe('createMiniMaxTtsService', () => {
  it('generates MP3 speech artifacts through MiniMax TTS', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { audio: Buffer.from('mp3-bytes').toString('hex') } })
    });
    const service = createMiniMaxTtsService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    await expect(
      service.speak({
        artifactDir,
        text: 'Short reply.',
        ttsId: 'tts-current',
        voiceStyle: 'focused'
      })
    ).resolves.toMatchObject({
      ok: true,
      audioPath: join(artifactDir, 'tts-current.mp3'),
      mimeType: 'audio/mpeg',
      text: 'Short reply.',
      ttsId: 'tts-current'
    });
    await expect(readFile(join(artifactDir, 'tts-current.mp3'), 'utf8')).resolves.toBe('mp3-bytes');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/t2a_v2',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-cp-token',
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('"model":"speech-2.8-hd"')
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      language_boost: 'English',
      voice_setting: {
        voice_id: 'English_expressive_narrator'
      }
    });
  });

  it('surfaces MiniMax base response errors when HTTP succeeds without audio', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: null,
        base_resp: {
          status_code: 2013,
          status_msg: 'invalid params, Mismatch type int64 with value null'
        }
      })
    });
    const service = createMiniMaxTtsService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    await expect(service.speak({ artifactDir, text: 'Hello', ttsId: 'tts-current' })).resolves.toEqual({
      ok: false,
      error: 'MiniMax TTS failed (2013): invalid params, Mismatch type int64 with value null',
      ttsId: 'tts-current'
    });
  });

  it('accepts base64 audio_file payloads from MiniMax-compatible responses', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        audio_file: Buffer.from('mp3-bytes').toString('base64'),
        base_resp: { status_code: 0, status_msg: 'success' }
      })
    });
    const service = createMiniMaxTtsService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    await expect(service.speak({ artifactDir, text: 'Hello', ttsId: 'tts-current' })).resolves.toMatchObject({
      ok: true,
      audioPath: join(artifactDir, 'tts-current.mp3')
    });
    await expect(readFile(join(artifactDir, 'tts-current.mp3'), 'utf8')).resolves.toBe('mp3-bytes');
  });

  it('redacts MiniMax TTS errors', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'bad key sk-cp-secret'
    });
    const service = createMiniMaxTtsService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    await expect(service.speak({ artifactDir, text: 'Hello', ttsId: 'tts-current' })).resolves.toMatchObject({
      ok: false,
      error: expect.not.stringContaining('sk-cp-secret'),
      ttsId: 'tts-current'
    });
  });
});
