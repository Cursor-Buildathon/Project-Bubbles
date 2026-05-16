import { describe, expect, it, vi } from 'vitest';
import { createMiniMaxSetupService, type SetupStatus } from './setupService.js';

function createHarness(overrides: Partial<Parameters<typeof createMiniMaxSetupService>[0]> = {}) {
  const storedStatus = {
    current: undefined as Awaited<ReturnType<ReturnType<typeof createMiniMaxSetupService>['getStatus']>> | undefined
  };
  const keyStore = {
    getGeneralApiKey: vi.fn().mockResolvedValue(undefined),
    setGeneralApiKey: vi.fn().mockResolvedValue(undefined),
    deleteGeneralApiKey: vi.fn().mockResolvedValue(undefined),
    getTokenPlanKey: vi.fn().mockResolvedValue(undefined),
    setTokenPlanKey: vi.fn().mockResolvedValue(undefined),
    deleteTokenPlanKey: vi.fn().mockResolvedValue(undefined),
    deleteAllMiniMaxKeys: vi.fn().mockResolvedValue(undefined)
  };
  const apiClient = vi.fn().mockResolvedValue({ ok: true });
  const cliManager = {
    installCommandPreview: 'npm install --global --prefix /tmp/bubbles/mmx-cli mmx-cli',
    detect: vi.fn().mockResolvedValue({ installed: true, path: '/usr/local/bin/mmx' }),
    install: vi.fn().mockResolvedValue({ ok: true }),
    authenticate: vi.fn().mockResolvedValue({ ok: true }),
    checkAuthStatus: vi.fn().mockResolvedValue({ ok: true }),
    checkQuota: vi.fn().mockResolvedValue({ ok: true }),
    verify: vi.fn().mockResolvedValue({ ok: true })
  };
  const statusStore = {
    read: vi.fn().mockImplementation(async () => storedStatus.current),
    write: vi.fn().mockImplementation(async (status) => {
      storedStatus.current = status;
    })
  };

  const service = createMiniMaxSetupService({
    keyStore,
    apiClient,
    cliManager,
    statusStore,
    now: () => '2026-05-14T10:00:00.000Z',
    ...overrides
  });

  return { service, keyStore, apiClient, cliManager, statusStore };
}

describe('createMiniMaxSetupService', () => {
  it('starts in needs_general_api_key when no General API key exists', async () => {
    const { service } = createHarness();

    await expect(service.getStatus()).resolves.toMatchObject({
      state: 'needs_general_api_key',
      mode: 'not_configured',
      generalApi: { verified: false },
      tokenPlan: { present: false, verified: false },
      cli: { installed: false, authenticated: false, verified: false }
    });
  });

  it('cannot reach ready with only the General API key', async () => {
    const { service, keyStore, apiClient, cliManager } = createHarness();

    await expect(service.saveGeneralApiKey('sk-cp-general')).resolves.toMatchObject({
      state: 'needs_token_plan_key',
      mode: 'not_configured',
      generalApi: { verified: true },
      tokenPlan: { present: false, verified: false },
      cli: { authenticated: false, verified: false }
    });

    expect(keyStore.setGeneralApiKey).toHaveBeenCalledWith('sk-cp-general');
    expect(apiClient).toHaveBeenCalledWith('sk-cp-general');
    expect(cliManager.authenticate).not.toHaveBeenCalled();
  });

  it('cannot reach ready with only the Token Plan key', async () => {
    const { service, keyStore, apiClient, cliManager } = createHarness();

    await expect(service.saveTokenPlanKey('sk-cp-token')).resolves.toMatchObject({
      state: 'needs_general_api_key',
      mode: 'not_configured',
      generalApi: { verified: false },
      tokenPlan: { present: false, verified: false }
    });

    expect(keyStore.setTokenPlanKey).not.toHaveBeenCalled();
    expect(apiClient).not.toHaveBeenCalled();
    expect(cliManager.authenticate).not.toHaveBeenCalled();
  });

  it('uses the Token Plan key, not the General API key, for CLI authentication', async () => {
    const { service, keyStore, apiClient, cliManager } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');

    await expect(service.saveTokenPlanKey('sk-cp-token')).resolves.toMatchObject({
      state: 'ready',
      mode: 'full',
      generalApi: { verified: true },
      tokenPlan: { present: true, verified: true },
      cli: { installed: true, authenticated: true, verified: true, path: '/usr/local/bin/mmx' }
    });

    expect(apiClient).not.toHaveBeenCalledWith('sk-cp-token');
    expect(cliManager.authenticate).toHaveBeenCalledWith('sk-cp-token');
    expect(cliManager.authenticate).not.toHaveBeenCalledWith('sk-cp-general');
    expect(cliManager.checkAuthStatus).toHaveBeenCalled();
    expect(cliManager.checkQuota).toHaveBeenCalled();
    expect(cliManager.verify).toHaveBeenCalled();
    expect(keyStore.setTokenPlanKey).toHaveBeenCalledWith('sk-cp-token');
  });

  it('requires CLI install approval after a Token Plan key is saved when mmx is missing', async () => {
    const { service, keyStore, cliManager } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');
    cliManager.detect.mockResolvedValue({ installed: false });

    await expect(service.saveTokenPlanKey('sk-cp-token')).resolves.toMatchObject({
      state: 'needs_cli_install',
      mode: 'not_configured',
      tokenPlan: { present: true, verified: false },
      cli: { installed: false, installCommandPreview: 'npm install --global --prefix /tmp/bubbles/mmx-cli mmx-cli' }
    });

    expect(cliManager.install).not.toHaveBeenCalled();
  });

  it('keeps setup incomplete and removes the Token Plan key when CLI auth fails', async () => {
    const { service, keyStore, cliManager } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');
    cliManager.authenticate.mockResolvedValue({ ok: false, error: 'bad token sk-cp-token' });

    await expect(service.saveTokenPlanKey('sk-cp-token')).resolves.toMatchObject({
      state: 'needs_token_plan_key',
      mode: 'not_configured',
      tokenPlan: { present: false, verified: false, error: 'bad token [REDACTED]' },
      cli: { installed: true, authenticated: false, verified: false }
    });

    expect(keyStore.deleteTokenPlanKey).toHaveBeenCalled();
  });

  it('installs CLI and authenticates with the stored Token Plan key', async () => {
    const { service, keyStore, cliManager } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');

    await expect(service.installCli()).resolves.toMatchObject({
      state: 'ready',
      mode: 'full',
      tokenPlan: { present: true, verified: true },
      cli: { installed: true, authenticated: true, verified: true }
    });

    expect(cliManager.install).toHaveBeenCalled();
    expect(cliManager.authenticate).toHaveBeenCalledWith('sk-cp-token');
  });

  it('retries by verifying the General API key before CLI work', async () => {
    const { service, keyStore, apiClient, cliManager } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');
    apiClient.mockResolvedValue({ ok: false, error: 'still bad sk-cp-general' });

    await expect(service.retry()).resolves.toMatchObject({
      state: 'setup_error',
      generalApi: { verified: false, error: 'still bad [REDACTED]' },
      tokenPlan: { present: true, verified: false }
    });

    expect(apiClient).toHaveBeenCalledWith('sk-cp-general');
    expect(cliManager.detect).not.toHaveBeenCalled();
  });

  it('does not force General API key re-entry on transient fetch failure when CLI recheck succeeds', async () => {
    const { service, keyStore, apiClient, cliManager } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');
    apiClient.mockResolvedValue({ ok: false, error: 'fetch failed' });

    await expect(service.retry()).resolves.toMatchObject({
      state: 'ready',
      mode: 'full',
      generalApi: { verified: true },
      tokenPlan: { present: true, verified: true },
      cli: { installed: true, authenticated: true, verified: true }
    });

    expect(apiClient).toHaveBeenCalledWith('sk-cp-general');
    expect(cliManager.detect).toHaveBeenCalled();
    expect(cliManager.verify).toHaveBeenCalled();
  });

  it('resets General API and Token Plan keys independently', async () => {
    const { service, keyStore } = createHarness();

    await service.resetGeneralApiKey();
    await service.resetTokenPlanKey();
    await service.resetAllMiniMax();

    expect(keyStore.deleteGeneralApiKey).toHaveBeenCalledTimes(1);
    expect(keyStore.deleteTokenPlanKey).toHaveBeenCalledTimes(1);
    expect(keyStore.deleteAllMiniMaxKeys).toHaveBeenCalledTimes(1);
  });

  it('marks CLI runtime network failures as setup errors without deleting stored keys', async () => {
    const { service, keyStore } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');
    await service.saveTokenPlanKey('sk-cp-token');

    await expect(
      service.markCliUnhealthy(
        'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.'
      )
    ).resolves.toMatchObject({
      state: 'setup_error',
      generalApi: { verified: true },
      tokenPlan: { present: true, verified: true },
      cli: {
        installed: true,
        authenticated: true,
        verified: false,
        error:
          'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.'
      }
    });

    expect(keyStore.deleteTokenPlanKey).not.toHaveBeenCalled();
    expect(keyStore.deleteAllMiniMaxKeys).not.toHaveBeenCalled();
  });

  it('recovers from a runtime CLI health error when recheck succeeds', async () => {
    const { service, keyStore } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');
    await service.saveTokenPlanKey('sk-cp-token');
    await service.markCliUnhealthy('MiniMax CLI cannot reach the network right now.');

    await expect(service.retry()).resolves.toMatchObject({
      state: 'ready',
      mode: 'full',
      generalApi: { verified: true },
      tokenPlan: { present: true, verified: true },
      cli: { installed: true, authenticated: true, verified: true, error: undefined }
    });
  });

  it('does not trust stored ready status when the expected CLI binary is missing', async () => {
    const { service, keyStore, cliManager, statusStore } = createHarness();
    keyStore.getGeneralApiKey.mockResolvedValue('sk-cp-general');
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');
    statusStore.read.mockResolvedValue(
      createStatus({
        state: 'ready',
        mode: 'full',
        generalApi: { verified: true },
        tokenPlan: { present: true, verified: true },
        cli: {
          installed: true,
          authenticated: true,
          verified: true,
          path: '/Users/dev/.local/bin/mmx',
          installCommandPreview: 'npm install --global --prefix /tmp/bubbles/mmx-cli mmx-cli'
        }
      })
    );
    cliManager.detect.mockResolvedValue({ installed: false });

    await expect(service.getStatus()).resolves.toMatchObject({
      state: 'needs_cli_install',
      mode: 'not_configured',
      generalApi: { verified: true },
      tokenPlan: { present: true, verified: false },
      cli: {
        installed: false,
        authenticated: false,
        verified: false,
        installCommandPreview: 'npm install --global --prefix /tmp/bubbles/mmx-cli mmx-cli'
      }
    });
  });
});

function createStatus(overrides: Partial<SetupStatus> = {}): SetupStatus {
  return {
    state: 'needs_general_api_key' as const,
    mode: 'not_configured' as const,
    generalApi: { verified: false },
    tokenPlan: { present: false, verified: false },
    cli: {
      installed: false,
      authenticated: false,
      verified: false,
      installCommandPreview: 'npm install --global --prefix /tmp/bubbles/mmx-cli mmx-cli'
    },
    updatedAt: '2026-05-14T10:00:00.000Z',
    ...overrides
  };
}
