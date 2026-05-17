import { describe, expect, it, vi } from 'vitest';
import { createMiniMaxSetupService, type SetupStatus } from './setupService.js';

function createHarness(overrides: Partial<Parameters<typeof createMiniMaxSetupService>[0]> = {}) {
  const storedStatus = {
    current: undefined as SetupStatus | undefined
  };
  const keyStore = {
    getTokenPlanKey: vi.fn().mockResolvedValue(undefined),
    setTokenPlanKey: vi.fn().mockResolvedValue(undefined),
    deleteTokenPlanKey: vi.fn().mockResolvedValue(undefined),
    deleteAllMiniMaxKeys: vi.fn().mockResolvedValue(undefined)
  };
  const apiClient = vi.fn().mockResolvedValue({ ok: true });
  const statusStore = {
    read: vi.fn().mockImplementation(async () => storedStatus.current),
    write: vi.fn().mockImplementation(async (status: SetupStatus) => {
      storedStatus.current = status;
    })
  };

  const service = createMiniMaxSetupService({
    keyStore,
    apiClient,
    statusStore,
    now: () => '2026-05-14T10:00:00.000Z',
    ...overrides
  });

  return { service, keyStore, apiClient, statusStore };
}

describe('createMiniMaxSetupService', () => {
  it('starts in needs_token_plan_key when no MiniMax Token Plan key exists', async () => {
    const { service } = createHarness();

    await expect(service.getStatus()).resolves.toEqual({
      state: 'needs_token_plan_key',
      mode: 'not_configured',
      tokenPlan: { present: false, verified: false },
      updatedAt: '2026-05-14T10:00:00.000Z'
    });
  });

  it('verifies and stores the Token Plan key through the direct MiniMax API', async () => {
    const { service, keyStore, apiClient } = createHarness();

    await expect(service.saveTokenPlanKey(' sk-cp-token ')).resolves.toMatchObject({
      state: 'ready',
      mode: 'full',
      tokenPlan: {
        present: true,
        verified: true,
        lastCheckedAt: '2026-05-14T10:00:00.000Z'
      }
    });

    expect(apiClient).toHaveBeenCalledWith('sk-cp-token');
    expect(keyStore.setTokenPlanKey).toHaveBeenCalledWith('sk-cp-token');
  });

  it('does not store a Token Plan key when direct verification fails', async () => {
    const { service, keyStore, apiClient } = createHarness();
    apiClient.mockResolvedValue({ ok: false, error: 'bad token sk-cp-secret' });

    await expect(service.saveTokenPlanKey('sk-cp-secret')).resolves.toMatchObject({
      state: 'setup_error',
      mode: 'not_configured',
      tokenPlan: {
        present: false,
        verified: false,
        error: 'bad token [REDACTED]'
      }
    });

    expect(keyStore.setTokenPlanKey).not.toHaveBeenCalled();
  });

  it('retries by verifying the stored Token Plan key', async () => {
    const { service, keyStore, apiClient } = createHarness();
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');

    await expect(service.retry()).resolves.toMatchObject({
      state: 'ready',
      mode: 'full',
      tokenPlan: { present: true, verified: true }
    });

    expect(apiClient).toHaveBeenCalledWith('sk-cp-token');
  });

  it('marks runtime MiniMax API failures as setup errors without deleting the stored key', async () => {
    const { service, keyStore } = createHarness();
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');

    await expect(service.markMiniMaxUnhealthy('MiniMax API cannot reach the network right now.')).resolves.toMatchObject({
      state: 'setup_error',
      mode: 'not_configured',
      tokenPlan: {
        present: true,
        verified: false,
        error: 'MiniMax API cannot reach the network right now.'
      }
    });

    expect(keyStore.deleteTokenPlanKey).not.toHaveBeenCalled();
  });

  it('resets the Token Plan key independently and keeps resetAll available for legacy key cleanup', async () => {
    const { service, keyStore } = createHarness();

    await service.resetTokenPlanKey();
    await service.resetAllMiniMax();

    expect(keyStore.deleteTokenPlanKey).toHaveBeenCalledTimes(1);
    expect(keyStore.deleteAllMiniMaxKeys).toHaveBeenCalledTimes(1);
  });

  it('does not trust a legacy CLI-shaped stored ready status', async () => {
    const { service, keyStore, statusStore } = createHarness();
    keyStore.getTokenPlanKey.mockResolvedValue('sk-cp-token');
    statusStore.read.mockResolvedValue(
      {
        state: 'ready',
        mode: 'full',
        generalApi: { verified: true },
        tokenPlan: { present: true, verified: true },
        cli: {
          installed: true,
          authenticated: true,
          verified: true
        },
        updatedAt: '2026-05-14T10:00:00.000Z'
      } as unknown as SetupStatus
    );

    await expect(service.getStatus()).resolves.toMatchObject({
      state: 'verifying_token_plan',
      mode: 'not_configured',
      tokenPlan: { present: true, verified: false }
    });
  });
});
