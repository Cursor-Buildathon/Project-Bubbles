import { redactSecrets } from '../security/redactSecrets.js';
import { type SecureKeyStore } from '../security/secureKeyStore.js';
import { type MiniMaxCliManager } from './minimaxCliManager.js';
import { type VerificationResult } from './minimaxApiClient.js';

export type SetupState =
  | 'needs_general_api_key'
  | 'verifying_general_api'
  | 'needs_token_plan_key'
  | 'checking_cli'
  | 'needs_cli_install'
  | 'authenticating_cli'
  | 'verifying_cli'
  | 'ready'
  | 'setup_error';

export interface SetupStatus {
  state: SetupState;
  mode: 'not_configured' | 'full';
  generalApi: {
    verified: boolean;
    lastCheckedAt?: string;
    error?: string;
  };
  tokenPlan: {
    present: boolean;
    verified: boolean;
    lastCheckedAt?: string;
    error?: string;
  };
  cli: {
    installed: boolean;
    path?: string;
    authenticated: boolean;
    verified: boolean;
    installCommandPreview: string;
    error?: string;
  };
  updatedAt: string;
}

export interface SetupStatusStore {
  read: () => Promise<SetupStatus | undefined>;
  write: (status: SetupStatus) => Promise<void>;
}

type SetupStatusOverrides = Omit<Partial<SetupStatus>, 'cli' | 'generalApi' | 'tokenPlan'> & {
  cli?: Partial<SetupStatus['cli']>;
  generalApi?: Partial<SetupStatus['generalApi']>;
  tokenPlan?: Partial<SetupStatus['tokenPlan']>;
};

type SetupKeyStore = Pick<
  SecureKeyStore,
  | 'deleteAllMiniMaxKeys'
  | 'deleteGeneralApiKey'
  | 'deleteTokenPlanKey'
  | 'getGeneralApiKey'
  | 'getTokenPlanKey'
  | 'setGeneralApiKey'
  | 'setTokenPlanKey'
>;

interface MiniMaxSetupServiceOptions {
  apiClient: (apiKey: string) => Promise<VerificationResult>;
  cliManager: MiniMaxCliManager;
  keyStore: SetupKeyStore;
  now?: () => string;
  statusStore: SetupStatusStore;
}

export interface MiniMaxSetupService {
  getStatus: () => Promise<SetupStatus>;
  installCli: () => Promise<SetupStatus>;
  markCliUnhealthy: (error: string) => Promise<SetupStatus>;
  resetAllMiniMax: () => Promise<SetupStatus>;
  resetGeneralApiKey: () => Promise<SetupStatus>;
  resetTokenPlanKey: () => Promise<SetupStatus>;
  retry: () => Promise<SetupStatus>;
  saveGeneralApiKey: (apiKey: string) => Promise<SetupStatus>;
  saveTokenPlanKey: (apiKey: string) => Promise<SetupStatus>;
}

export function createMiniMaxSetupService({
  apiClient,
  cliManager,
  keyStore,
  now = () => new Date().toISOString(),
  statusStore
}: MiniMaxSetupServiceOptions): MiniMaxSetupService {
  function createStatus(overrides: SetupStatusOverrides = {}): SetupStatus {
    const base: SetupStatus = {
      state: 'needs_general_api_key',
      mode: 'not_configured',
      generalApi: {
        verified: false
      },
      tokenPlan: {
        present: false,
        verified: false
      },
      cli: {
        installed: false,
        authenticated: false,
        verified: false,
        installCommandPreview: cliManager.installCommandPreview
      },
      updatedAt: now()
    };

    return {
      ...base,
      ...overrides,
      generalApi: {
        ...base.generalApi,
        ...overrides.generalApi
      },
      tokenPlan: {
        ...base.tokenPlan,
        ...overrides.tokenPlan
      },
      cli: {
        ...base.cli,
        ...overrides.cli
      }
    };
  }

  async function saveStatus(status: SetupStatus) {
    const safeStatus = sanitizeStatus(status);
    await statusStore.write(safeStatus);
    return safeStatus;
  }

  async function getGeneralApiKey() {
    try {
      return await keyStore.getGeneralApiKey();
    } catch {
      return undefined;
    }
  }

  async function getTokenPlanKey() {
    try {
      return await keyStore.getTokenPlanKey();
    } catch {
      return undefined;
    }
  }

  function needsGeneralApiKeyStatus(): SetupStatus {
    return createStatus();
  }

  function needsTokenPlanKeyStatus(
    tokenPlan: Partial<SetupStatus['tokenPlan']> = {},
    cli: Partial<SetupStatus['cli']> = {}
  ): SetupStatus {
    return createStatus({
      state: 'needs_token_plan_key',
      generalApi: { verified: true, lastCheckedAt: now() },
      tokenPlan: {
        present: false,
        verified: false,
        ...tokenPlan
      },
      cli
    });
  }

  async function verifyGeneralApiKey(apiKey: string, tokenPlanPresent = false): Promise<VerificationResult> {
    await saveStatus(
      createStatus({
        state: 'verifying_general_api',
        tokenPlan: { present: tokenPlanPresent, verified: false }
      })
    );

    return apiClient(apiKey);
  }

  async function continueAfterTokenPlanPresent(tokenPlanKey: string): Promise<SetupStatus> {
    await saveStatus(
      createStatus({
        state: 'checking_cli',
        generalApi: { verified: true, lastCheckedAt: now() },
        tokenPlan: { present: true, verified: false }
      })
    );

    const detection = await cliManager.detect();

    if (!detection.installed) {
      return saveStatus(
        createStatus({
          state: 'needs_cli_install',
          generalApi: { verified: true, lastCheckedAt: now() },
          tokenPlan: { present: true, verified: false },
          cli: {
            installed: false,
            authenticated: false,
            verified: false,
            installCommandPreview: cliManager.installCommandPreview
          }
        })
      );
    }

    return authenticateAndVerifyCli(tokenPlanKey, detection.path);
  }

  async function authenticateAndVerifyCli(tokenPlanKey: string, detectedPath?: string): Promise<SetupStatus> {
    await saveStatus(
      createStatus({
        state: 'authenticating_cli',
        generalApi: { verified: true, lastCheckedAt: now() },
        tokenPlan: { present: true, verified: false },
        cli: {
          installed: true,
          path: detectedPath,
          authenticated: false,
          verified: false,
          installCommandPreview: cliManager.installCommandPreview
        }
      })
    );

    const authResult = await cliManager.authenticate(tokenPlanKey);

    if (!authResult.ok) {
      await keyStore.deleteTokenPlanKey();
      return saveStatus(
        needsTokenPlanKeyStatus(
          {
            error: authResult.error
          },
          {
            installed: true,
            path: detectedPath,
            authenticated: false,
            verified: false
          }
        )
      );
    }

    const authStatusResult = await cliManager.checkAuthStatus();

    if (!authStatusResult.ok) {
      return saveStatus(
        needsTokenPlanKeyStatus(
          {
            present: true,
            error: authStatusResult.error
          },
          {
            installed: true,
            path: detectedPath,
            authenticated: false,
            verified: false
          }
        )
      );
    }

    await saveStatus(
      createStatus({
        state: 'verifying_cli',
        generalApi: { verified: true, lastCheckedAt: now() },
        tokenPlan: { present: true, verified: false },
        cli: {
          installed: true,
          path: detectedPath,
          authenticated: true,
          verified: false,
          installCommandPreview: cliManager.installCommandPreview
        }
      })
    );

    const quotaResult = await cliManager.checkQuota();

    if (!quotaResult.ok) {
      return cliVerificationErrorStatus(quotaResult.error, detectedPath);
    }

    const verifyResult = await cliManager.verify();

    if (!verifyResult.ok) {
      return cliVerificationErrorStatus(verifyResult.error, detectedPath);
    }

    return saveStatus(
      createStatus({
        state: 'ready',
        mode: 'full',
        generalApi: { verified: true, lastCheckedAt: now() },
        tokenPlan: { present: true, verified: true, lastCheckedAt: now() },
        cli: {
          installed: true,
          path: detectedPath,
          authenticated: true,
          verified: true,
          installCommandPreview: cliManager.installCommandPreview
        }
      })
    );
  }

  async function cliVerificationErrorStatus(error: string | undefined, detectedPath?: string) {
    return saveStatus(
      createStatus({
        state: 'setup_error',
        generalApi: { verified: true, lastCheckedAt: now() },
        tokenPlan: { present: true, verified: false },
        cli: {
          installed: true,
          path: detectedPath,
          authenticated: true,
          verified: false,
          installCommandPreview: cliManager.installCommandPreview,
          error
        }
      })
    );
  }

  async function buildStoredStatus(): Promise<SetupStatus> {
    const [generalApiKey, tokenPlanKey] = await Promise.all([getGeneralApiKey(), getTokenPlanKey()]);

    if (!generalApiKey) {
      return needsGeneralApiKeyStatus();
    }

    if (!tokenPlanKey) {
      return needsTokenPlanKeyStatus();
    }

    const storedStatus = await statusStore.read();

    if (!isCurrentSetupStatus(storedStatus)) {
      return createStatus({
        state: 'checking_cli',
        generalApi: { verified: true },
        tokenPlan: { present: true, verified: false }
      });
    }

    if (storedStatus.state !== 'ready') {
      return storedStatus;
    }

    const detection = await cliManager.detect();

    if (!detection.installed) {
      return createStatus({
        state: 'needs_cli_install',
        generalApi: storedStatus.generalApi,
        tokenPlan: {
          ...storedStatus.tokenPlan,
          present: true,
          verified: false
        },
        cli: {
          installed: false,
          authenticated: false,
          verified: false,
          installCommandPreview: cliManager.installCommandPreview
        }
      });
    }

    return {
      ...storedStatus,
      cli: {
        ...storedStatus.cli,
        installed: true,
        path: detection.path,
        installCommandPreview: cliManager.installCommandPreview
      }
    };
  }

  return {
    async getStatus() {
      return buildStoredStatus();
    },

    async installCli() {
      const [generalApiKey, tokenPlanKey] = await Promise.all([getGeneralApiKey(), getTokenPlanKey()]);

      if (!generalApiKey) {
        return needsGeneralApiKeyStatus();
      }

      if (!tokenPlanKey) {
        return saveStatus(needsTokenPlanKeyStatus());
      }

      const installResult = await cliManager.install();

      if (!installResult.ok) {
        return saveStatus(
          createStatus({
            state: 'setup_error',
            generalApi: { verified: true, lastCheckedAt: now() },
            tokenPlan: { present: true, verified: false },
            cli: {
              installed: false,
              authenticated: false,
              verified: false,
              installCommandPreview: cliManager.installCommandPreview,
              error: installResult.error
            }
          })
        );
      }

      const detection = await cliManager.detect();
      return authenticateAndVerifyCli(tokenPlanKey, detection.path);
    },

    async markCliUnhealthy(error: string) {
      const storedStatus = await buildStoredStatus();

      return saveStatus(
        createStatus({
          state: 'setup_error',
          mode: 'not_configured',
          generalApi: {
            ...storedStatus.generalApi,
            verified: Boolean(storedStatus.generalApi.verified)
          },
          tokenPlan: {
            ...storedStatus.tokenPlan,
            present: true,
            verified: Boolean(storedStatus.tokenPlan.verified)
          },
          cli: {
            ...storedStatus.cli,
            installed: storedStatus.cli.installed,
            authenticated: storedStatus.cli.authenticated,
            verified: false,
            installCommandPreview: cliManager.installCommandPreview,
            error: redactSecrets(error)
          }
        })
      );
    },

    async resetAllMiniMax() {
      await keyStore.deleteAllMiniMaxKeys();
      return saveStatus(createStatus());
    },

    async resetGeneralApiKey() {
      await keyStore.deleteGeneralApiKey();
      return saveStatus(createStatus());
    },

    async resetTokenPlanKey() {
      await keyStore.deleteTokenPlanKey();
      const generalApiKey = await getGeneralApiKey();

      if (!generalApiKey) {
        return saveStatus(createStatus());
      }

      return saveStatus(needsTokenPlanKeyStatus());
    },

    async retry() {
      const [generalApiKey, tokenPlanKey] = await Promise.all([getGeneralApiKey(), getTokenPlanKey()]);

      if (!generalApiKey) {
        return needsGeneralApiKeyStatus();
      }

      const generalVerification = await verifyGeneralApiKey(generalApiKey, Boolean(tokenPlanKey));

      if (!generalVerification.ok) {
        if (tokenPlanKey && isTransientNetworkError(generalVerification.error)) {
          return continueAfterTokenPlanPresent(tokenPlanKey);
        }

        return saveStatus(
          createStatus({
            state: 'setup_error',
            generalApi: {
              verified: false,
              lastCheckedAt: now(),
              error: generalVerification.error
            },
            tokenPlan: { present: Boolean(tokenPlanKey), verified: false }
          })
        );
      }

      if (!tokenPlanKey) {
        return saveStatus(needsTokenPlanKeyStatus());
      }

      return continueAfterTokenPlanPresent(tokenPlanKey);
    },

    async saveGeneralApiKey(apiKey: string) {
      const trimmedKey = apiKey.trim();
      const verification = await verifyGeneralApiKey(trimmedKey);

      if (!verification.ok) {
        return saveStatus(
          createStatus({
            state: 'setup_error',
            generalApi: {
              verified: false,
              lastCheckedAt: now(),
              error: verification.error
            }
          })
        );
      }

      await keyStore.setGeneralApiKey(trimmedKey);
      return saveStatus(needsTokenPlanKeyStatus());
    },

    async saveTokenPlanKey(apiKey: string) {
      const generalApiKey = await getGeneralApiKey();

      if (!generalApiKey) {
        return needsGeneralApiKeyStatus();
      }

      const trimmedKey = apiKey.trim();
      await keyStore.setTokenPlanKey(trimmedKey);
      return continueAfterTokenPlanPresent(trimmedKey);
    }
  };
}

function sanitizeStatus(status: SetupStatus): SetupStatus {
  return {
    ...status,
    generalApi: {
      ...status.generalApi,
      error: status.generalApi.error ? redactSecrets(status.generalApi.error) : undefined
    },
    tokenPlan: {
      ...status.tokenPlan,
      error: status.tokenPlan.error ? redactSecrets(status.tokenPlan.error) : undefined
    },
    cli: {
      ...status.cli,
      error: status.cli.error ? redactSecrets(status.cli.error) : undefined
    }
  };
}

function isCurrentSetupStatus(status: SetupStatus | undefined): status is SetupStatus {
  return Boolean(
    status &&
      status.generalApi &&
      status.tokenPlan &&
      status.cli &&
      'verified' in status.generalApi &&
      'present' in status.tokenPlan &&
      'verified' in status.cli
  );
}

function isTransientNetworkError(error: string | undefined) {
  return Boolean(error && /fetch failed|network|connection|timeout|ENOTFOUND|ECONN|ETIMEDOUT/i.test(error));
}
