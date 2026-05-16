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
          instrumental: true
        })
      })
    );
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
  });
});
