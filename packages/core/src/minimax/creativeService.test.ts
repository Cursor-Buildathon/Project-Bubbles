import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCreativeService, createMiniMaxCreativeService } from './creativeService.js';

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'bubbles-media-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('createCreativeService', () => {
  it('routes creative requests through the configured runner', async () => {
    const service = createCreativeService({
      runCreativeTask: async (request) => ({
        ok: true,
        text: `created ${request.kind}: ${request.prompt}`
      })
    });

    await expect(service.run({ kind: 'voice', prompt: 'friendly intro' })).resolves.toEqual({
      ok: true,
      text: 'created voice: friendly intro'
    });
  });
});

describe('createMiniMaxCreativeService', () => {
  it('generates image artifacts through the direct MiniMax image API', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { image_base64: Buffer.from('png-bytes').toString('base64') } })
    });
    const service = createMiniMaxCreativeService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    const result = await service.run({
      artifactDir,
      fixture: false,
      kind: 'image',
      prompt: 'neon desk setup'
    });

    expect(result).toMatchObject({
      ok: true,
      artifact: {
        kind: 'image',
        path: join(artifactDir, 'image.png')
      }
    });
    await expect(readFile(join(artifactDir, 'image.png'), 'utf8')).resolves.toBe('png-bytes');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/image_generation',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-cp-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'image-01',
          prompt: 'neon desk setup',
          response_format: 'base64',
          n: 1,
          prompt_optimizer: false
        })
      })
    );
  });

  it('accepts documented MiniMax image_base64 arrays', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { image_base64: [Buffer.from('array-png-bytes').toString('base64')] } })
    });
    const service = createMiniMaxCreativeService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    const result = await service.run({
      artifactDir,
      fixture: false,
      kind: 'image',
      prompt: 'glass greenhouse on Mars'
    });

    expect(result).toMatchObject({
      ok: true,
      artifact: {
        kind: 'image',
        path: join(artifactDir, 'image.png')
      }
    });
    await expect(readFile(join(artifactDir, 'image.png'), 'utf8')).resolves.toBe('array-png-bytes');
  });

  it('generates music artifacts through the direct MiniMax music API', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { audio: Buffer.from('mp3-bytes').toString('hex') } })
    });
    const service = createMiniMaxCreativeService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    const result = await service.run({
      artifactDir,
      fixture: false,
      kind: 'music',
      prompt: 'upbeat launch theme'
    });

    expect(result).toMatchObject({
      ok: true,
      artifact: {
        kind: 'audio',
        path: join(artifactDir, 'music.mp3')
      }
    });
    await expect(readFile(join(artifactDir, 'music.mp3'), 'utf8')).resolves.toBe('mp3-bytes');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/music_generation',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-cp-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'music-2.6',
          prompt: 'upbeat launch theme',
          output_format: 'hex',
          audio_setting: {
            sample_rate: 44100,
            bitrate: 256000,
            format: 'mp3'
          },
          is_instrumental: true
        })
      })
    );
  });

  it('returns the provider rejection reason when music generation is not accepted', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ base_resp: { status_code: 1008, status_msg: 'bad music request sk-cp-secret' } })
    });
    const service = createMiniMaxCreativeService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    const result = await service.run({
      artifactDir,
      fixture: false,
      kind: 'music',
      prompt: 'provider rejected music'
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('MiniMax music generation failed: bad music request')
    });
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).not.toContain('sk-cp-secret');
    }
  });

  it('generates video artifacts through the async MiniMax video API', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ task_id: 'task-123', base_resp: { status_code: 0, status_msg: 'success' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ task_id: 'task-123', status: 'Processing', base_resp: { status_code: 0, status_msg: 'success' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          task_id: 'task-123',
          status: 'Success',
          file_id: 'file-456',
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          file: { file_id: 'file-456', download_url: 'https://download.example/video.mp4' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from('mp4-bytes')
      });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const service = createMiniMaxCreativeService({
      apiKey: 'sk-cp-token',
      fetch: fetchMock,
      sleep,
      videoPollIntervalMs: 0
    });

    const result = await service.run({
      artifactDir,
      fixture: false,
      kind: 'video',
      prompt: 'waves rolling over black sand'
    });

    expect(result).toMatchObject({
      ok: true,
      artifact: {
        kind: 'video',
        path: join(artifactDir, 'video.mp4')
      },
      text: 'The video is ready.'
    });
    await expect(readFile(join(artifactDir, 'video.mp4'), 'utf8')).resolves.toBe('mp4-bytes');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.minimax.io/v1/video_generation',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-cp-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'MiniMax-Hailuo-2.3',
          prompt: 'waves rolling over black sand',
          duration: 6,
          resolution: '768P',
          prompt_optimizer: false
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.minimax.io/v1/query/video_generation?task_id=task-123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://api.minimax.io/v1/files/retrieve?file_id=file-456',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://download.example/video.mp4',
      expect.objectContaining({ method: 'GET' })
    );
    expect(sleep).toHaveBeenCalledWith(0);
  });

  it('accepts numeric MiniMax video task and file ids', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ task_id: 123, base_resp: { status_code: 0, status_msg: 'success' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ task_id: 123, status: 'Success', file_id: 456, base_resp: { status_code: 0, status_msg: 'success' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          file: { file_id: 456, download_url: 'https://download.example/numeric-video.mp4' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from('numeric-mp4-bytes')
      });
    const service = createMiniMaxCreativeService({
      apiKey: 'sk-cp-token',
      fetch: fetchMock,
      sleep: vi.fn().mockResolvedValue(undefined),
      videoPollIntervalMs: 0
    });

    await expect(
      service.run({
        artifactDir,
        fixture: false,
        kind: 'video',
        prompt: 'numeric ids'
      })
    ).resolves.toMatchObject({
      ok: true,
      artifact: {
        kind: 'video',
        path: join(artifactDir, 'video.mp4')
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.minimax.io/v1/query/video_generation?task_id=123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.minimax.io/v1/files/retrieve?file_id=456',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns the provider rejection reason when video task creation is not accepted', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ base_resp: { status_code: 1008, status_msg: 'insufficient balance for sk-cp-secret' } })
    });
    const service = createMiniMaxCreativeService({ apiKey: 'sk-cp-token', fetch: fetchMock });

    const result = await service.run({
      artifactDir,
      fixture: false,
      kind: 'video',
      prompt: 'provider rejected video'
    });

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('MiniMax video generation failed: insufficient balance')
    });
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).not.toContain('sk-cp-secret');
    }
  });

  it('returns a redacted error when video generation fails', async () => {
    const artifactDir = await makeTempDir();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ task_id: 'task-123', base_resp: { status_code: 0, status_msg: 'success' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          task_id: 'task-123',
          status: 'Fail',
          base_resp: { status_code: 1001, status_msg: 'bad key sk-cp-secret' }
        })
      });
    const service = createMiniMaxCreativeService({
      apiKey: 'sk-cp-token',
      fetch: fetchMock,
      sleep: vi.fn().mockResolvedValue(undefined),
      videoPollIntervalMs: 0
    });

    await expect(
      service.run({
        artifactDir,
        fixture: false,
        kind: 'video',
        prompt: 'failing video'
      })
    ).resolves.toMatchObject({
      ok: false,
      error: expect.not.stringContaining('sk-cp-secret')
    });
  });

  it('writes deterministic fixture artifacts for CI', async () => {
    const artifactDir = await makeTempDir();
    const service = createMiniMaxCreativeService({
      apiKey: 'sk-cp-token',
      fetch: vi.fn().mockRejectedValue(new Error('should not fetch'))
    });

    await expect(
      service.run({
        artifactDir,
        fixture: true,
        kind: 'image',
        prompt: 'fixture poster'
      })
    ).resolves.toMatchObject({
      ok: true,
      artifact: {
        kind: 'image',
        path: join(artifactDir, 'image.svg')
      }
    });

    await expect(
      service.run({
        artifactDir,
        fixture: true,
        kind: 'video',
        prompt: 'fixture video'
      })
    ).resolves.toMatchObject({
      ok: true,
      artifact: {
        kind: 'video',
        path: join(artifactDir, 'video.mp4')
      },
      text: 'The video is ready.'
    });
  });
});
