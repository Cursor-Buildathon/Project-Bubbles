import { describe, expect, it, vi } from 'vitest';
import { createVoiceSetupService } from './voiceSetupService.js';

function createHarness() {
  const keys = {
    gemini: undefined as string | undefined,
    minimax: 'sk-cp-token' as string | undefined,
    openai: undefined as string | undefined
  };
  const keyStore = {
    deleteAllVoiceKeys: vi.fn(async () => {
      keys.gemini = undefined;
      keys.openai = undefined;
    }),
    deleteGeminiVoiceKey: vi.fn(async () => {
      keys.gemini = undefined;
    }),
    deleteOpenAiVoiceKey: vi.fn(async () => {
      keys.openai = undefined;
    }),
    getGeminiVoiceKey: vi.fn(async () => keys.gemini),
    getOpenAiVoiceKey: vi.fn(async () => keys.openai),
    setGeminiVoiceKey: vi.fn(async (apiKey: string) => {
      keys.gemini = apiKey;
    }),
    setOpenAiVoiceKey: vi.fn(async (apiKey: string) => {
      keys.openai = apiKey;
    })
  };
  const service = createVoiceSetupService({
    enabled: true,
    getMiniMaxTokenPlanKey: async () => keys.minimax,
    keyStore,
    now: () => '2026-05-16T10:00:00.000Z'
  });

  return { keys, keyStore, service };
}

describe('createVoiceSetupService', () => {
  it('starts with optional STT providers missing and MiniMax TTS ready when Token Plan exists', async () => {
    const { service } = createHarness();

    await expect(service.getStatus()).resolves.toMatchObject({
      enabled: true,
      stt: {
        ready: false,
        gemini: { present: false, verified: false },
        openai: { present: false, verified: false }
      },
      tts: { provider: 'minimax', ready: true }
    });
  });

  it('saves Gemini as the preferred STT provider without exposing the key', async () => {
    const { keyStore, service } = createHarness();

    await expect(service.saveGeminiKey(' gemini-secret ')).resolves.toMatchObject({
      stt: {
        ready: true,
        preferredProvider: 'gemini',
        gemini: { present: true, verified: true }
      }
    });
    expect(keyStore.setGeminiVoiceKey).toHaveBeenCalledWith('gemini-secret');
  });

  it('falls back to OpenAI as preferred provider when Gemini is absent', async () => {
    const { service } = createHarness();

    await expect(service.saveOpenAiKey('openai-secret')).resolves.toMatchObject({
      stt: {
        ready: true,
        preferredProvider: 'openai',
        openai: { present: true, verified: true }
      }
    });
  });

  it('resets voice keys independently from MiniMax setup', async () => {
    const { keyStore, service } = createHarness();
    await service.saveGeminiKey('gemini-secret');
    await service.saveOpenAiKey('openai-secret');

    await expect(service.resetAllVoiceKeys()).resolves.toMatchObject({
      stt: { ready: false }
    });
    expect(keyStore.deleteAllVoiceKeys).toHaveBeenCalledTimes(1);
  });
});
