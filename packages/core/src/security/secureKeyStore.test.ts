import { describe, expect, it, vi } from 'vitest';
import { createSecureKeyStore } from './secureKeyStore.js';

describe('createSecureKeyStore', () => {
  it('stores the MiniMax Token Plan key in its Keychain service', async () => {
    const runCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    const keyStore = createSecureKeyStore({ runCommand, platform: 'darwin' });

    await keyStore.setTokenPlanKey('sk-cp-token-secret');

    expect(runCommand).toHaveBeenCalledWith('/usr/bin/security', [
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

    await expect(keyStore.setTokenPlanKey('sk-cp-super-secret')).rejects.toThrow('failed to save [REDACTED]');
  });

  it('reads and deletes the Token Plan key and keeps reset-all legacy cleanup', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: 'sk-cp-token\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    const keyStore = createSecureKeyStore({ runCommand, platform: 'darwin' });

    await expect(keyStore.getTokenPlanKey()).resolves.toBe('sk-cp-token');
    await keyStore.deleteTokenPlanKey();
    await keyStore.deleteAllMiniMaxKeys();

    expect(runCommand).toHaveBeenNthCalledWith(1, '/usr/bin/security', [
      'find-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.minimax.token-plan-key',
      '-w'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(2, '/usr/bin/security', [
      'delete-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.minimax.token-plan-key'
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

  it('stores, reads, and resets optional voice provider keys separately', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'gemini-secret\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'openai-secret\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    const keyStore = createSecureKeyStore({ runCommand, platform: 'darwin' });

    await keyStore.setGeminiVoiceKey('gemini-secret');
    await keyStore.setOpenAiVoiceKey('openai-secret');
    await expect(keyStore.getGeminiVoiceKey()).resolves.toBe('gemini-secret');
    await expect(keyStore.getOpenAiVoiceKey()).resolves.toBe('openai-secret');
    await keyStore.deleteAllVoiceKeys();

    expect(runCommand).toHaveBeenNthCalledWith(1, '/usr/bin/security', [
      'add-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.voice.gemini-api-key',
      '-w',
      'gemini-secret',
      '-U'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(2, '/usr/bin/security', [
      'add-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.voice.openai-api-key',
      '-w',
      'openai-secret',
      '-U'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(5, '/usr/bin/security', [
      'delete-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.voice.gemini-api-key'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(6, '/usr/bin/security', [
      'delete-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.voice.openai-api-key'
    ]);
  });

  it('stores, reads, and resets the Tavily API key separately from MiniMax and voice keys', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'tvly-secret\n', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    const keyStore = createSecureKeyStore({ runCommand, platform: 'darwin' });

    await keyStore.setTavilyKey('tvly-secret');
    await expect(keyStore.getTavilyKey()).resolves.toBe('tvly-secret');
    await keyStore.deleteTavilyKey();

    expect(runCommand).toHaveBeenNthCalledWith(1, '/usr/bin/security', [
      'add-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.tavily.api-key',
      '-w',
      'tvly-secret',
      '-U'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(2, '/usr/bin/security', [
      'find-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.tavily.api-key',
      '-w'
    ]);
    expect(runCommand).toHaveBeenNthCalledWith(3, '/usr/bin/security', [
      'delete-generic-password',
      '-a',
      'minimax',
      '-s',
      'com.bubbles.tavily.api-key'
    ]);
  });
});
