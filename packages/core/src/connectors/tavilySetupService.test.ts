import { describe, expect, it, vi } from 'vitest';
import { createTavilySetupService } from './tavilySetupService.js';

describe('createTavilySetupService', () => {
  it('saves and verifies a Tavily key through the MCP health check', async () => {
    const keyStore = {
      deleteTavilyKey: vi.fn(),
      getTavilyKey: vi.fn().mockResolvedValue(undefined),
      setTavilyKey: vi.fn()
    };
    const mcpClient = {
      call: vi.fn().mockResolvedValue({ ok: true, result: {} })
    };
    const onStatusChange = vi.fn();
    const service = createTavilySetupService({ keyStore, mcpClient, now: () => '2026-05-16T10:00:00.000Z', onStatusChange });

    await expect(service.saveApiKey(' tvly-secret ')).resolves.toEqual({
      state: 'ready',
      updatedAt: '2026-05-16T10:00:00.000Z'
    });
    expect(keyStore.setTavilyKey).toHaveBeenCalledWith('tvly-secret');
    expect(mcpClient.call).toHaveBeenCalledWith('tvly-secret', 'tavily-search', {
      include_images: false,
      max_results: 1,
      query: 'Bubbles Tavily health check',
      search_depth: 'basic'
    });
    expect(onStatusChange).toHaveBeenCalledWith({ state: 'verifying', updatedAt: '2026-05-16T10:00:00.000Z' });
  });

  it('redacts verification failures and supports reset', async () => {
    const keyStore = {
      deleteTavilyKey: vi.fn(),
      getTavilyKey: vi.fn().mockResolvedValue('tvly-secret'),
      setTavilyKey: vi.fn()
    };
    const service = createTavilySetupService({
      keyStore,
      mcpClient: { call: vi.fn().mockResolvedValue({ ok: false, error: 'bad tvly-secret' }) },
      now: () => '2026-05-16T10:00:00.000Z'
    });

    await expect(service.retry()).resolves.toEqual({
      error: 'bad [REDACTED]',
      state: 'setup_error',
      updatedAt: '2026-05-16T10:00:00.000Z'
    });
    await expect(service.resetApiKey()).resolves.toEqual({
      state: 'needs_api_key',
      updatedAt: '2026-05-16T10:00:00.000Z'
    });
    expect(keyStore.deleteTavilyKey).toHaveBeenCalledTimes(1);
  });
});
