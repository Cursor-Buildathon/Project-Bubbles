import { describe, expect, it } from 'vitest';
import { createCreativeService, createMiniMaxCreativeService } from './creativeService.js';

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

  it('constructs explicit MiniMax CLI commands for image artifacts', async () => {
    const commands: Array<{ command: string; args: string[] }> = [];
    const service = createMiniMaxCreativeService({
      runCommand: async (command, args) => {
        commands.push({ command, args });
        return { exitCode: 0, stderr: '', stdout: '' };
      }
    });

    await expect(
      service.run({
        artifactDir: '/tmp/bubbles-artifacts',
        fixture: false,
        kind: 'image',
        prompt: 'neon desk setup'
      })
    ).resolves.toMatchObject({
      ok: true,
      artifact: {
        kind: 'image'
      }
    });
    expect(commands).toEqual([
      {
        command: 'mmx',
        args: ['image', 'generate', '--prompt', 'neon desk setup', '--out-dir', '/tmp/bubbles-artifacts']
      }
    ]);
  });

  it('constructs explicit MiniMax CLI commands for music artifacts', async () => {
    const commands: Array<{ command: string; args: string[] }> = [];
    const service = createMiniMaxCreativeService({
      runCommand: async (command, args) => {
        commands.push({ command, args });
        return { exitCode: 0, stderr: '', stdout: '' };
      }
    });

    await service.run({
      artifactDir: '/tmp/bubbles-artifacts',
      fixture: false,
      kind: 'music',
      prompt: 'upbeat launch theme'
    });

    expect(commands[0]).toEqual({
      command: 'mmx',
      args: ['music', 'generate', '--prompt', 'upbeat launch theme', '--out', '/tmp/bubbles-artifacts/music.mp3']
    });
  });

  it('writes deterministic fixture artifacts for CI', async () => {
    const service = createMiniMaxCreativeService({
      runCommand: async () => ({ exitCode: 1, stderr: 'should not run', stdout: '' })
    });

    await expect(
      service.run({
        artifactDir: '/tmp/bubbles-artifacts',
        fixture: true,
        kind: 'image',
        prompt: 'fixture poster'
      })
    ).resolves.toMatchObject({
      ok: true,
      artifact: {
        kind: 'image',
        path: '/tmp/bubbles-artifacts/image.svg'
      }
    });
  });
});
