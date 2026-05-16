import { describe, expect, it, vi } from 'vitest';
import { createMiniMaxCliManager } from './minimaxCliManager.js';

describe('createMiniMaxCliManager', () => {
  it('detects when mmx is available', async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stdout: '/usr/local/bin/mmx\n',
      stderr: '',
      exitCode: 0
    });
    const cli = createMiniMaxCliManager({ runCommand });

    await expect(cli.detect()).resolves.toEqual({
      installed: true,
      path: '/usr/local/bin/mmx'
    });
  });

  it('detects when mmx is missing', async () => {
    const runCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: 'not found', exitCode: 1 });
    const cli = createMiniMaxCliManager({ runCommand });

    await expect(cli.detect()).resolves.toEqual({
      installed: false
    });
  });

  it('previews and installs mmx-cli only through the explicit install method', async () => {
    const runCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const cli = createMiniMaxCliManager({ runCommand, localInstallPrefix: '/Users/dev/Library/Bubbles/tools/mmx-cli' });

    expect(cli.installCommandPreview).toBe(
      'npm install --global --prefix /Users/dev/Library/Bubbles/tools/mmx-cli mmx-cli'
    );
    await cli.install();

    expect(runCommand).toHaveBeenCalledWith('npm', [
      'install',
      '--global',
      '--prefix',
      '/Users/dev/Library/Bubbles/tools/mmx-cli',
      'mmx-cli'
    ]);
  });

  it('detects the app-local mmx binary before falling back to the global path', async () => {
    const runCommand = vi.fn().mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    const cli = createMiniMaxCliManager({ runCommand, localInstallPrefix: '/Users/dev/Library/Bubbles/tools/mmx-cli' });

    await expect(cli.detect()).resolves.toEqual({
      installed: true,
      path: '/Users/dev/Library/Bubbles/tools/mmx-cli/bin/mmx'
    });

    expect(runCommand).toHaveBeenCalledWith('test', ['-x', '/Users/dev/Library/Bubbles/tools/mmx-cli/bin/mmx']);
  });

  it('can require the app-local mmx binary without falling back to the global path', async () => {
    const runCommand = vi.fn().mockImplementation(async (command: string) => {
      if (command === 'test') {
        return { stdout: '', stderr: '', exitCode: 1 };
      }

      return { stdout: '/Users/dev/.local/bin/mmx\n', stderr: '', exitCode: 0 };
    });
    const cli = createMiniMaxCliManager({
      runCommand,
      localInstallPrefix: '/Users/dev/Library/Bubbles/tools/mmx-cli',
      useGlobalFallback: false
    });

    await expect(cli.detect()).resolves.toEqual({ installed: false });
    expect(runCommand).not.toHaveBeenCalledWith('which', ['mmx']);
  });

  it('authenticates and verifies with redacted failures', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'bad sk-cp-secret', exitCode: 1 });
    const cli = createMiniMaxCliManager({ runCommand });

    await expect(cli.authenticate('sk-cp-secret')).resolves.toEqual({ ok: true });
    await expect(cli.verify()).resolves.toEqual({ ok: true });
    await expect(cli.verify()).resolves.toEqual({ ok: false, error: 'bad [REDACTED]' });

    expect(runCommand).toHaveBeenNthCalledWith(1, 'mmx', ['auth', 'login', '--api-key', 'sk-cp-secret']);
    expect(runCommand).toHaveBeenNthCalledWith(2, 'mmx', [
      'text',
      'chat',
      '--message',
      'Reply with exactly: ok'
    ]);
  });

  it('uses the detected app-local binary for authentication and verification', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '', exitCode: 0 });
    const cli = createMiniMaxCliManager({ runCommand, localInstallPrefix: '/Users/dev/Library/Bubbles/tools/mmx-cli' });

    await cli.detect();
    await cli.authenticate('sk-cp-secret');
    await cli.verify();

    expect(runCommand).toHaveBeenNthCalledWith(2, '/Users/dev/Library/Bubbles/tools/mmx-cli/bin/mmx', [
      'auth',
      'login',
      '--api-key',
      'sk-cp-secret'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(3, '/Users/dev/Library/Bubbles/tools/mmx-cli/bin/mmx', [
      'text',
      'chat',
      '--message',
      'Reply with exactly: ok'
    ]);
  });

  it('checks auth status with json output using the detected binary', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '{"method":"api-key","source":"config.json"}', stderr: '', exitCode: 0 });
    const cli = createMiniMaxCliManager({ runCommand, localInstallPrefix: '/Users/dev/Library/Bubbles/tools/mmx-cli' });

    await cli.detect();
    await expect(cli.checkAuthStatus()).resolves.toEqual({ ok: true });

    expect(runCommand).toHaveBeenNthCalledWith(2, '/Users/dev/Library/Bubbles/tools/mmx-cli/bin/mmx', [
      'auth',
      'status',
      '--output',
      'json'
    ]);
  });

  it('checks Token Plan quota with the detected binary', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'M2.7 4499 requests remaining', stderr: '', exitCode: 0 });
    const cli = createMiniMaxCliManager({ runCommand, localInstallPrefix: '/Users/dev/Library/Bubbles/tools/mmx-cli' });

    await cli.detect();
    await expect(cli.checkQuota()).resolves.toEqual({ ok: true });

    expect(runCommand).toHaveBeenNthCalledWith(2, '/Users/dev/Library/Bubbles/tools/mmx-cli/bin/mmx', ['quota']);
  });

  it('turns npm permission failures into a concise error', async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: [
        'npm error code EACCES',
        "npm error path /usr/local/lib/node_modules/mmx-cli",
        'npm error Error: EACCES: permission denied, mkdir /usr/local/lib/node_modules/mmx-cli',
        'npm error A complete log of this run can be found in: /Users/dev/.npm/_logs/debug-0.log'
      ].join('\n'),
      exitCode: 1
    });
    const cli = createMiniMaxCliManager({ runCommand, localInstallPrefix: '/Users/dev/Library/Bubbles/tools/mmx-cli' });

    await expect(cli.install()).resolves.toEqual({
      ok: false,
      error:
        'MiniMax CLI install hit a permissions error. Bubbles installs the CLI in an app-local folder and setup will stay incomplete until mmx is available.'
    });
  });

  it('turns MiniMax CLI region validation failures into a concise Token Plan error', async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stdout: [
        'Detecting region... failed',
        'Warning: API key failed validation against all regions (global, cn).',
        "This usually means the API key is invalid or the network is blocking requests. Falling back to 'global'.",
        'Subsequent request failed with status 401'
      ].join('\n'),
      stderr: '',
      exitCode: 1
    });
    const cli = createMiniMaxCliManager({ runCommand });

    await expect(cli.authenticate('sk-cp-secret')).resolves.toEqual({
      ok: false,
      error: 'MiniMax CLI could not validate the Token Plan Key. Setup will stay incomplete until CLI auth works.'
    });
  });

  it('turns MiniMax CLI network JSON failures into a concise recheck error', async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: JSON.stringify({
        error: {
          code: 6,
          message: 'Network request failed.',
          hint: 'Check your network connection.'
        }
      }),
      exitCode: 1
    });
    const cli = createMiniMaxCliManager({ runCommand });

    await expect(cli.verify()).resolves.toEqual({
      ok: false,
      error: 'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.'
    });
  });

  it('truncates long CLI errors and keeps secrets redacted', async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: `bad sk-cp-secret ${'x'.repeat(900)}`,
      exitCode: 1
    });
    const cli = createMiniMaxCliManager({ runCommand });
    const result = await cli.verify();

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).not.toContain('sk-cp-secret');
    expect(result.ok ? '' : result.error.length).toBeLessThanOrEqual(360);
  });
});
