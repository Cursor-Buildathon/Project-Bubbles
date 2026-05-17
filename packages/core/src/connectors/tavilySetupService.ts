import { redactSecrets } from '../security/redactSecrets.js';
import { type SecureKeyStore } from '../security/secureKeyStore.js';
import { type TavilyMcpClientLike } from './tavilyResearchConnector.js';

export type TavilySetupState = 'needs_api_key' | 'verifying' | 'ready' | 'setup_error';

export interface TavilySetupStatus {
  error?: string;
  state: TavilySetupState;
  updatedAt: string;
}

interface TavilySetupServiceOptions {
  keyStore: Pick<SecureKeyStore, 'deleteTavilyKey' | 'getTavilyKey' | 'setTavilyKey'>;
  mcpClient: TavilyMcpClientLike;
  now?: () => string;
  onStatusChange?: (status: TavilySetupStatus) => void;
}

export function createTavilySetupService({
  keyStore,
  mcpClient,
  now = () => new Date().toISOString(),
  onStatusChange
}: TavilySetupServiceOptions) {
  let status: TavilySetupStatus = { state: 'needs_api_key', updatedAt: now() };

  function publish(next: TavilySetupStatus) {
    status = next;
    onStatusChange?.(status);
    return status;
  }

  async function verify(apiKey: string) {
    publish({ state: 'verifying', updatedAt: now() });
    const result = await mcpClient.call(apiKey, 'tavily-search', {
      include_images: false,
      max_results: 1,
      query: 'Bubbles Tavily health check',
      search_depth: 'basic'
    });

    if (!result.ok) {
      return publish({ error: redactSecrets(result.error), state: 'setup_error', updatedAt: now() });
    }

    return publish({ state: 'ready', updatedAt: now() });
  }

  return {
    async getStatus() {
      const key = await keyStore.getTavilyKey();

      if (!key) {
        return publish({ state: 'needs_api_key', updatedAt: now() });
      }

      return status.state === 'ready' ? status : verify(key);
    },

    async retry() {
      const key = await keyStore.getTavilyKey();
      return key ? verify(key) : publish({ state: 'needs_api_key', updatedAt: now() });
    },

    async resetApiKey() {
      await keyStore.deleteTavilyKey();
      return publish({ state: 'needs_api_key', updatedAt: now() });
    },

    async saveApiKey(apiKey: string) {
      const trimmed = apiKey.trim();

      if (!trimmed) {
        return publish({ error: 'Tavily API key is required.', state: 'setup_error', updatedAt: now() });
      }

      await keyStore.setTavilyKey(trimmed);
      return verify(trimmed);
    }
  };
}

export type TavilySetupService = ReturnType<typeof createTavilySetupService>;
