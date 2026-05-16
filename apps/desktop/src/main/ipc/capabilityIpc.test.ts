import { describe, expect, it, vi } from 'vitest';
import { registerCapabilityIpc } from './capabilityIpc.js';

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  openExternal: vi.fn().mockResolvedValue(undefined),
  openPath: vi.fn().mockResolvedValue('')
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.handle
  },
  shell: {
    openExternal: mocks.openExternal,
    openPath: mocks.openPath
  }
}));

describe('registerCapabilityIpc', () => {
  it('rejects local artifact paths outside the artifact root', async () => {
    registerCapabilityIpc({ artifactRoot: '/tmp/bubbles-artifacts' });
    const handler = mocks.handle.mock.calls.find(([channel]) => channel === 'capabilities:open-artifact')?.[1];

    await expect(handler({}, { path: '/tmp/elsewhere/image.svg' })).resolves.toEqual({
      ok: false,
      error: 'Artifact is outside the approved artifact folder.'
    });
  });

  it('opens site URLs through the system browser', async () => {
    registerCapabilityIpc({ artifactRoot: '/tmp/bubbles-artifacts' });
    const handler = mocks.handle.mock.calls.find(([channel]) => channel === 'capabilities:open-artifact')?.[1];

    await expect(handler({}, { url: 'http://127.0.0.1:4173' })).resolves.toEqual({ ok: true });
    expect(mocks.openExternal).toHaveBeenCalledWith('http://127.0.0.1:4173');
  });
});
