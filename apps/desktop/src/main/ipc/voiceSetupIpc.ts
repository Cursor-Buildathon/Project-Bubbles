import { ipcMain } from 'electron';
import { createVoiceSetupService, type SecureKeyStore, type VoiceSetupService, type VoiceSetupStatus } from '@bubbles/core';

interface RegisterVoiceSetupIpcOptions {
  enabled: boolean;
  getMiniMaxTokenPlanKey: () => Promise<string | undefined>;
  keyStore: Pick<
    SecureKeyStore,
    | 'deleteAllVoiceKeys'
    | 'deleteGeminiVoiceKey'
    | 'deleteOpenAiVoiceKey'
    | 'getGeminiVoiceKey'
    | 'getOpenAiVoiceKey'
    | 'setGeminiVoiceKey'
    | 'setOpenAiVoiceKey'
  >;
  onStatusChange?: (status: VoiceSetupStatus) => void;
}

export function registerVoiceSetupIpc({
  enabled,
  getMiniMaxTokenPlanKey,
  keyStore,
  onStatusChange
}: RegisterVoiceSetupIpcOptions): VoiceSetupService {
  const service = createVoiceSetupService({ enabled, getMiniMaxTokenPlanKey, keyStore });

  async function updateStatus(action: () => Promise<VoiceSetupStatus>) {
    const status = await action();
    onStatusChange?.(status);
    return status;
  }

  ipcMain.handle('voice-setup:get-status', () => service.getStatus());
  ipcMain.handle('voice-setup:save-gemini-key', async (_event, apiKey: string) =>
    updateStatus(() => service.saveGeminiKey(apiKey))
  );
  ipcMain.handle('voice-setup:save-openai-key', async (_event, apiKey: string) =>
    updateStatus(() => service.saveOpenAiKey(apiKey))
  );
  ipcMain.handle('voice-setup:reset-gemini-key', () => updateStatus(() => service.resetGeminiKey()));
  ipcMain.handle('voice-setup:reset-openai-key', () => updateStatus(() => service.resetOpenAiKey()));
  ipcMain.handle('voice-setup:reset-all-voice-keys', () => updateStatus(() => service.resetAllVoiceKeys()));

  return service;
}
