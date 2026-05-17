import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCapabilityIpc } from './capabilityIpc.js';

const mocks = vi.hoisted(() => {
  const state = {
    downloadsPath: '/tmp/bubbles-downloads'
  };

  return {
    getPath: vi.fn((name: string) => (name === 'downloads' ? state.downloadsPath : '/tmp')),
    handle: vi.fn(),
    openExternal: vi.fn().mockResolvedValue(undefined),
    openPath: vi.fn().mockResolvedValue(''),
    state
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: mocks.getPath
  },
  ipcMain: {
    handle: mocks.handle
  },
  shell: {
    openExternal: mocks.openExternal,
    openPath: mocks.openPath
  }
}));

const tempDirs: string[] = [];

async function makeTempDir(name: string) {
  const dir = await mkdtemp(join(tmpdir(), name));
  tempDirs.push(dir);
  return dir;
}

describe('registerCapabilityIpc', () => {
  beforeEach(() => {
    mocks.handle.mockClear();
    mocks.openExternal.mockClear();
    mocks.openPath.mockClear();
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('rejects local artifact paths outside the artifact root', async () => {
    registerCapabilityIpc({ artifactRoot: '/tmp/bubbles-artifacts' });
    const handler = ipcHandler('capabilities:open-artifact');

    await expect(handler({}, { path: '/tmp/elsewhere/image.svg' })).resolves.toEqual({
      ok: false,
      error: 'Artifact is outside the approved artifact folder.'
    });
  });

  it('opens site URLs through the system browser', async () => {
    registerCapabilityIpc({ artifactRoot: '/tmp/bubbles-artifacts' });
    const handler = ipcHandler('capabilities:open-artifact');

    await expect(handler({}, { url: 'http://127.0.0.1:4173' })).resolves.toEqual({ ok: true });
    expect(mocks.openExternal).toHaveBeenCalledWith('http://127.0.0.1:4173');
  });

  it('rejects artifact downloads outside the artifact root', async () => {
    registerCapabilityIpc({ artifactRoot: '/tmp/bubbles-artifacts' });
    const handler = ipcHandler('capabilities:download-artifact');

    await expect(handler({}, { path: '/tmp/elsewhere/image.png', title: 'Elsewhere image' })).resolves.toEqual({
      ok: false,
      error: 'Artifact is outside the approved artifact folder.'
    });
  });

  it('copies approved artifacts into Downloads with a safe file name', async () => {
    const artifactRoot = await makeTempDir('bubbles-artifacts-');
    const downloadsPath = await makeTempDir('bubbles-downloads-');
    const artifactPath = join(artifactRoot, 'image.png');
    mocks.state.downloadsPath = downloadsPath;
    await writeFile(artifactPath, 'png-bytes', 'utf8');

    registerCapabilityIpc({ artifactRoot });
    const handler = ipcHandler('capabilities:download-artifact');

    const result = await handler({}, { path: artifactPath, title: 'Neon desk / evening' });

    expect(result).toEqual({
      ok: true,
      path: join(downloadsPath, 'Neon desk evening.png')
    });
    await expect(readFile(join(downloadsPath, 'Neon desk evening.png'), 'utf8')).resolves.toBe('png-bytes');
  });
});

function ipcHandler(channel: string) {
  const handler = mocks.handle.mock.calls.find(([candidate]) => candidate === channel)?.[1];

  if (!handler) {
    throw new Error(`Missing IPC handler for ${channel}.`);
  }

  return handler;
}
