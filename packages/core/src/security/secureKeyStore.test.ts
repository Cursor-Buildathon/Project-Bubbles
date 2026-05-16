import { describe, expect, it, vi } from 'vitest';
import { createSecureKeyStore } from './secureKeyStore.js';

describe('createSecureKeyStore', () => {
  it('stores the MiniMax General API key and Token Plan key in separate Keychain services', async () => {
    const runCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const keyStore = createSecureKeyStore({ runCommand, platform: 'darwin' });

    await keyStore.setGeneralApiKey('sk-cp-general-secret');
    await keyStore.setTokenPlanKey('sk-cp-token-secret');

    expect(runCommand).toHaveBeenNthCalledWith(1, '/usr/bin/security', [
      'add-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.minimax.general-api-key',
      '-w',
      'sk-cp-general-secret',
      '-U'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(2, '/usr/bin/security', [
      'add-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.minimax.token-plan-key',
      '-w',
      'sk-cp-token-secret',
      '-U'
    ]);
  });

  it('redacts command errors so raw keys do not escape to callers', async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: 'failed to save sk-cp-super-secret',
      exitCode: 1
    });
    const keyStore = createSecureKeyStore({ runCommand, platform: 'darwin' });

    await expect(keyStore.setGeneralApiKey('sk-cp-super-secret')).rejects.toThrow('failed to save [REDACTED]');
  });

  it('reads and deletes both MiniMax keys from their configured Keychain services', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: 'sk-cp-general\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'sk-cp-token\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    const keyStore = createSecureKeyStore({ runCommand, platform: 'darwin' });

    await expect(keyStore.getGeneralApiKey()).resolves.toBe('sk-cp-general');
    await expect(keyStore.getTokenPlanKey()).resolves.toBe('sk-cp-token');
    await keyStore.deleteGeneralApiKey();
    await keyStore.deleteTokenPlanKey();

    expect(runCommand).toHaveBeenNthCalledWith(1, '/usr/bin/security', [
      'find-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.minimax.general-api-key',
      '-w'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(2, '/usr/bin/security', [
      'find-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.minimax.token-plan-key',
      '-w'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(3, '/usr/bin/security', [
      'delete-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.minimax.general-api-key'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(4, '/usr/bin/security', [
      'delete-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.minimax.token-plan-key'
    ]);
  });
});
