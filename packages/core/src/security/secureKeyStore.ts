import { redactSecrets } from './redactSecrets.js';
import { type CommandRunner } from '../shared/commandRunner.js';

const defaultLegacyGeneralApiServiceName = 'com.bubbles.minimax.general-api-key';
const defaultTokenPlanServiceName = 'com.bubbles.minimax.token-plan-key';
const defaultGeminiVoiceServiceName = 'com.bubbles.voice.gemini-api-key';
const defaultOpenAiVoiceServiceName = 'com.bubbles.voice.openai-api-key';
const defaultTavilyServiceName = 'com.bubbles.tavily.api-key';
const defaultAccountName = 'minimax';

interface SecureKeyStoreOptions {
  accountName?: string;
  geminiVoiceServiceName?: string;
  openAiVoiceServiceName?: string;
  platform?: NodeJS.Platform;
  runCommand: CommandRunner;
  legacyGeneralApiServiceName?: string;
  tavilyServiceName?: string;
  tokenPlanServiceName?: string;
}

export interface SecureKeyStore {
  deleteAllMiniMaxKeys: () => Promise<void>;
  deleteAllVoiceKeys: () => Promise<void>;
  deleteGeminiVoiceKey: () => Promise<void>;
  deleteOpenAiVoiceKey: () => Promise<void>;
  deleteTavilyKey: () => Promise<void>;
  deleteTokenPlanKey: () => Promise<void>;
  getGeminiVoiceKey: () => Promise<string | undefined>;
  getOpenAiVoiceKey: () => Promise<string | undefined>;
  getTavilyKey: () => Promise<string | undefined>;
  getTokenPlanKey: () => Promise<string | undefined>;
  setGeminiVoiceKey: (apiKey: string) => Promise<void>;
  setOpenAiVoiceKey: (apiKey: string) => Promise<void>;
  setTavilyKey: (apiKey: string) => Promise<void>;
  setTokenPlanKey: (apiKey: string) => Promise<void>;
}

export function createSecureKeyStore({
  accountName = defaultAccountName,
  geminiVoiceServiceName = defaultGeminiVoiceServiceName,
  legacyGeneralApiServiceName = defaultLegacyGeneralApiServiceName,
  openAiVoiceServiceName = defaultOpenAiVoiceServiceName,
  platform = process.platform,
  runCommand,
  tavilyServiceName = defaultTavilyServiceName,
  tokenPlanServiceName = defaultTokenPlanServiceName
}: SecureKeyStoreOptions): SecureKeyStore {
  function assertMacOS() {
    if (platform !== 'darwin') {
      throw new Error('MiniMax secure key storage currently requires macOS Keychain.');
    }
  }

  async function runSecurity(args: string[]) {
    assertMacOS();
    const result = await runCommand('/usr/bin/security', args);

    if (result.exitCode !== 0) {
      throw new Error(redactSecrets(result.stderr || result.stdout || 'Keychain command failed.'));
    }

    return result;
  }

  async function deleteKey(serviceName: string) {
    await runSecurity(['delete-generic-password', '-a', accountName, '-s', serviceName]);
  }

  async function getKey(serviceName: string) {
    const result = await runSecurity(['find-generic-password', '-a', accountName, '-s', serviceName, '-w']);
    const apiKey = result.stdout.trim();

    return apiKey || undefined;
  }

  async function setKey(serviceName: string, apiKey: string) {
    await runSecurity(['add-generic-password', '-a', accountName, '-s', serviceName, '-w', apiKey, '-U']);
  }

  return {
    async deleteAllMiniMaxKeys() {
      await Promise.allSettled([deleteKey(legacyGeneralApiServiceName), deleteKey(tokenPlanServiceName)]);
    },

    async deleteAllVoiceKeys() {
      await Promise.allSettled([deleteKey(geminiVoiceServiceName), deleteKey(openAiVoiceServiceName)]);
    },

    async deleteGeminiVoiceKey() {
      await deleteKey(geminiVoiceServiceName);
    },

    async deleteOpenAiVoiceKey() {
      await deleteKey(openAiVoiceServiceName);
    },

    async deleteTavilyKey() {
      await deleteKey(tavilyServiceName);
    },

    async deleteTokenPlanKey() {
      await deleteKey(tokenPlanServiceName);
    },

    async getGeminiVoiceKey() {
      return getKey(geminiVoiceServiceName);
    },

    async getOpenAiVoiceKey() {
      return getKey(openAiVoiceServiceName);
    },

    async getTavilyKey() {
      return getKey(tavilyServiceName);
    },

    async getTokenPlanKey() {
      return getKey(tokenPlanServiceName);
    },

    async setGeminiVoiceKey(apiKey: string) {
      await setKey(geminiVoiceServiceName, apiKey);
    },

    async setOpenAiVoiceKey(apiKey: string) {
      await setKey(openAiVoiceServiceName, apiKey);
    },

    async setTavilyKey(apiKey: string) {
      await setKey(tavilyServiceName, apiKey);
    },

    async setTokenPlanKey(apiKey: string) {
      await setKey(tokenPlanServiceName, apiKey);
    }
  };
}
