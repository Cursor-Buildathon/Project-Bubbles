import { redactSecrets } from '../security/redactSecrets.js';
import { type SecureKeyStore } from '../security/secureKeyStore.js';
import { type VerificationResult } from './minimaxApiClient.js';

export type SetupState = 'needs_token_plan_key' | 'verifying_token_plan' | 'ready' | 'setup_error';

export interface SetupStatus {
  state: SetupState;
  mode: 'not_configured' | 'full';
  tokenPlan: {
    present: boolean;
    verified: boolean;
    lastCheckedAt?: string;
    error?: string;
  };
  updatedAt: string;
}

export interface SetupStatusStore {
  read: () => Promise<SetupStatus | undefined>;
  write: (status: SetupStatus) => Promise<void>;
}

type SetupStatusOverrides = Omit<Partial<SetupStatus>, 'tokenPlan'> & {
  tokenPlan?: Partial<SetupStatus['tokenPlan']>;
};

type SetupKeyStore = Pick<
  SecureKeyStore,
  'deleteAllMiniMaxKeys' | 'deleteTokenPlanKey' | 'getTokenPlanKey' | 'setTokenPlanKey'
>;

interface MiniMaxSetupServiceOptions {
  apiClient: (apiKey: string) => Promise<VerificationResult>;
  keyStore: SetupKeyStore;
  now?: () => string;
  statusStore: SetupStatusStore;
}

export interface MiniMaxSetupService {
  getStatus: () => Promise<SetupStatus>;
  markMiniMaxUnhealthy: (error: string) => Promise<SetupStatus>;
  resetAllMiniMax: () => Promise<SetupStatus>;
  resetTokenPlanKey: () => Promise<SetupStatus>;
  retry: () => Promise<SetupStatus>;
  saveTokenPlanKey: (apiKey: string) => Promise<SetupStatus>;
}

export function createMiniMaxSetupService({
  apiClient,
  keyStore,
  now = () => new Date().toISOString(),
  statusStore
}: MiniMaxSetupServiceOptions): MiniMaxSetupService {
  function createStatus(overrides: SetupStatusOverrides = {}): SetupStatus {
    const base: SetupStatus = {
      state: 'needs_token_plan_key',
      mode: 'not_configured',
      tokenPlan: {
        present: false,
        verified: false
      },
      updatedAt: now()
    };

    return {
      ...base,
      ...overrides,
      tokenPlan: {
        ...base.tokenPlan,
        ...overrides.tokenPlan
      }
    };
  }

  async function saveStatus(status: SetupStatus) {
    const safeStatus = sanitizeStatus(status);
    await statusStore.write(safeStatus);
    return safeStatus;
  }

  async function getTokenPlanKey() {
    try {
      return await keyStore.getTokenPlanKey();
    } catch {
      return undefined;
    }
  }

  function needsTokenPlanKeyStatus(tokenPlan: Partial<SetupStatus['tokenPlan']> = {}): SetupStatus {
    return createStatus({
      state: 'needs_token_plan_key',
      tokenPlan: {
        present: false,
        verified: false,
        ...tokenPlan
      }
    });
  }

  async function verifyAndStoreTokenPlanKey(apiKey: string, shouldPersist: boolean): Promise<SetupStatus> {
    await saveStatus(
      createStatus({
        state: 'verifying_token_plan',
        tokenPlan: { present: true, verified: false }
      })
    );

    const verification = await apiClient(apiKey);

    if (!verification.ok) {
      return saveStatus(
        createStatus({
          state: 'setup_error',
          tokenPlan: {
            present: false,
            verified: false,
            lastCheckedAt: now(),
            error: verification.error
          }
        })
      );
    }

    if (shouldPersist) {
      await keyStore.setTokenPlanKey(apiKey);
    }

    return saveStatus(
      createStatus({
        state: 'ready',
        mode: 'full',
        tokenPlan: {
          present: true,
          verified: true,
          lastCheckedAt: now()
        }
      })
    );
  }

  async function buildStoredStatus(): Promise<SetupStatus> {
    const tokenPlanKey = await getTokenPlanKey();

    if (!tokenPlanKey) {
      return needsTokenPlanKeyStatus();
    }

    const storedStatus = await statusStore.read();

    if (!isCurrentSetupStatus(storedStatus)) {
      return createStatus({
        state: 'verifying_token_plan',
        tokenPlan: { present: true, verified: false }
      });
    }

    return storedStatus;
  }

  return {
    async getStatus() {
      return buildStoredStatus();
    },

    async markMiniMaxUnhealthy(error: string) {
      const tokenPlanKey = await getTokenPlanKey();

      return saveStatus(
        createStatus({
          state: 'setup_error',
          tokenPlan: {
            present: Boolean(tokenPlanKey),
            verified: false,
            error
          }
        })
      );
    },

    async resetAllMiniMax() {
      await keyStore.deleteAllMiniMaxKeys();
      return saveStatus(createStatus());
    },

    async resetTokenPlanKey() {
      await keyStore.deleteTokenPlanKey();
      return saveStatus(createStatus());
    },

    async retry() {
      const tokenPlanKey = await getTokenPlanKey();

      if (!tokenPlanKey) {
        return needsTokenPlanKeyStatus();
      }

      return verifyAndStoreTokenPlanKey(tokenPlanKey, false);
    },

    async saveTokenPlanKey(apiKey: string) {
      const trimmedKey = apiKey.trim();

      if (!trimmedKey) {
        return saveStatus(needsTokenPlanKeyStatus());
      }

      return verifyAndStoreTokenPlanKey(trimmedKey, true);
    }
  };
}

function sanitizeStatus(status: SetupStatus): SetupStatus {
  return {
    ...status,
    tokenPlan: {
      ...status.tokenPlan,
      error: status.tokenPlan.error ? redactSecrets(status.tokenPlan.error) : undefined
    }
  };
}

function isCurrentSetupStatus(status: SetupStatus | undefined): status is SetupStatus {
  return Boolean(
    status &&
      ['needs_token_plan_key', 'verifying_token_plan', 'ready', 'setup_error'].includes(status.state) &&
      status.tokenPlan &&
      'present' in status.tokenPlan &&
      'verified' in status.tokenPlan &&
      !('cli' in status) &&
      !('generalApi' in status)
  );
}
