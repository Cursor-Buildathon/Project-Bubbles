import { redactSecrets } from '../security/redactSecrets.js';
import { type SecureKeyStore } from '../security/secureKeyStore.js';

export interface VoiceProviderSetupStatus {
  present: boolean;
  verified: boolean;
  error?: string;
}

export interface VoiceSetupStatus {
  enabled: boolean;
  stt: {
    ready: boolean;
    preferredProvider?: 'gemini' | 'openai';
    gemini: VoiceProviderSetupStatus;
    openai: VoiceProviderSetupStatus;
  };
  tts: {
    provider: 'minimax';
    ready: boolean;
  };
  updatedAt: string;
}

type VoiceSetupKeyStore = Pick<
  SecureKeyStore,
  | 'deleteAllVoiceKeys'
  | 'deleteGeminiVoiceKey'
  | 'deleteOpenAiVoiceKey'
  | 'getGeminiVoiceKey'
  | 'getOpenAiVoiceKey'
  | 'setGeminiVoiceKey'
  | 'setOpenAiVoiceKey'
>;

interface VoiceSetupServiceOptions {
  enabled: boolean;
  getMiniMaxTokenPlanKey: () => Promise<string | undefined>;
  keyStore: VoiceSetupKeyStore;
  now?: () => string;
}

export interface VoiceSetupService {
  getStatus: () => Promise<VoiceSetupStatus>;
  resetAllVoiceKeys: () => Promise<VoiceSetupStatus>;
  resetGeminiKey: () => Promise<VoiceSetupStatus>;
  resetOpenAiKey: () => Promise<VoiceSetupStatus>;
  saveGeminiKey: (apiKey: string) => Promise<VoiceSetupStatus>;
  saveOpenAiKey: (apiKey: string) => Promise<VoiceSetupStatus>;
}

export function createVoiceSetupService({
  enabled,
  getMiniMaxTokenPlanKey,
  keyStore,
  now = () => new Date().toISOString()
}: VoiceSetupServiceOptions): VoiceSetupService {
  async function buildStatus(error?: { provider: 'gemini' | 'openai'; message: string }): Promise<VoiceSetupStatus> {
    const [geminiKey, openAiKey, miniMaxKey] = await Promise.all([
      readOptionalKey(() => keyStore.getGeminiVoiceKey()),
      readOptionalKey(() => keyStore.getOpenAiVoiceKey()),
      readOptionalKey(getMiniMaxTokenPlanKey)
    ]);
    const geminiPresent = Boolean(geminiKey);
    const openAiPresent = Boolean(openAiKey);

    return {
      enabled,
      stt: {
        ready: geminiPresent || openAiPresent,
        preferredProvider: geminiPresent ? 'gemini' : openAiPresent ? 'openai' : undefined,
        gemini: {
          present: geminiPresent,
          verified: geminiPresent,
          error: error?.provider === 'gemini' ? redactSecrets(error.message) : undefined
        },
        openai: {
          present: openAiPresent,
          verified: openAiPresent,
          error: error?.provider === 'openai' ? redactSecrets(error.message) : undefined
        }
      },
      tts: {
        provider: 'minimax',
        ready: Boolean(miniMaxKey)
      },
      updatedAt: now()
    };
  }

  async function saveKey(
    provider: 'gemini' | 'openai',
    apiKey: string,
    setter: (apiKey: string) => Promise<void>
  ): Promise<VoiceSetupStatus> {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      return buildStatus({ provider, message: 'Voice API key is empty.' });
    }

    try {
      await setter(trimmedKey);
      return buildStatus();
    } catch (error) {
      return buildStatus({ provider, message: redactSecrets(error) });
    }
  }

  return {
    getStatus: () => buildStatus(),

    async resetAllVoiceKeys() {
      await keyStore.deleteAllVoiceKeys();
      return buildStatus();
    },

    async resetGeminiKey() {
      await keyStore.deleteGeminiVoiceKey();
      return buildStatus();
    },

    async resetOpenAiKey() {
      await keyStore.deleteOpenAiVoiceKey();
      return buildStatus();
    },

    saveGeminiKey(apiKey: string) {
      return saveKey('gemini', apiKey, keyStore.setGeminiVoiceKey);
    },

    saveOpenAiKey(apiKey: string) {
      return saveKey('openai', apiKey, keyStore.setOpenAiVoiceKey);
    }
  };
}

async function readOptionalKey(read: () => Promise<string | undefined>) {
  try {
    return await read();
  } catch {
    return undefined;
  }
}
