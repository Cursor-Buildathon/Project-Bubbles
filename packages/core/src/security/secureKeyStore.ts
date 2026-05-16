import { redactSecrets } from './redactSecrets.js';
import { type CommandRunner } from '../shared/commandRunner.js';

const defaultGeneralApiServiceName = 'com.bubbles.minimax.general-api-key';
const defaultTokenPlanServiceName = 'com.bubbles.minimax.token-plan-key';
const defaultAccountName = 'minimax';

interface SecureKeyStoreOptions {
  accountName?: string;
  platform?: NodeJS.Platform;
  runCommand: CommandRunner;
  generalApiServiceName?: string;
  tokenPlanServiceName?: string;
}

export interface SecureKeyStore {
  deleteAllMiniMaxKeys: () => Promise<void>;
  deleteGeneralApiKey: () => Promise<void>;
  deleteTokenPlanKey: () => Promise<void>;
  getGeneralApiKey: () => Promise<string | undefined>;
  getTokenPlanKey: () => Promise<string | undefined>;
  setGeneralApiKey: (apiKey: string) => Promise<void>;
  setTokenPlanKey: (apiKey: string) => Promise<void>;
}

export function createSecureKeyStore({
  accountName = defaultAccountName,
  generalApiServiceName = defaultGeneralApiServiceName,
  platform = process.platform,
  runCommand,
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
      await Promise.allSettled([deleteKey(generalApiServiceName), deleteKey(tokenPlanServiceName)]);
    },

    async deleteGeneralApiKey() {
      await deleteKey(generalApiServiceName);
    },

    async deleteTokenPlanKey() {
      await deleteKey(tokenPlanServiceName);
    },

    async getGeneralApiKey() {
      return getKey(generalApiServiceName);
    },

    async getTokenPlanKey() {
      return getKey(tokenPlanServiceName);
    },

    async setGeneralApiKey(apiKey: string) {
      await setKey(generalApiServiceName, apiKey);
    },

    async setTokenPlanKey(apiKey: string) {
      await setKey(tokenPlanServiceName, apiKey);
    }
  };
}

export function createLegacySecureKeyStore({
  accountName = defaultAccountName,
  platform = process.platform,
  runCommand,
  serviceName = 'com.bubbles.minimax-api-key'
}: SecureKeyStoreOptions & { serviceName?: string }) {
  return createSecureKeyStore({
    accountName,
    generalApiServiceName: serviceName,
    platform,
    runCommand,
    tokenPlanServiceName: `${serviceName}.token-plan`
  });
}
