import { describe, expect, it, vi } from 'vitest';
import { movePackagedMacAppToTrash, resolvePackagedMacAppBundlePath } from './appLifecycle.js';

describe('app lifecycle helpers', () => {
  it('resolves the packaged macOS app bundle from the executable path', () => {
    expect(
      resolvePackagedMacAppBundlePath({
        execPath: '/Applications/Bubbles MVP.app/Contents/MacOS/Bubbles MVP',
        isPackaged: true,
        platform: 'darwin'
      })
    ).toEqual({ ok: true, appBundlePath: '/Applications/Bubbles MVP.app' });
  });

  it('returns unavailable in non-packaged development mode', () => {
    expect(
      resolvePackagedMacAppBundlePath({
        execPath: '/Users/dev/Documents/GitHub/Project-Bubbles/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
        isPackaged: false,
        platform: 'darwin'
      })
    ).toEqual({ ok: false, error: 'Move to Trash is available only from the packaged macOS app.' });
  });

  it('returns unavailable outside macOS', () => {
    expect(
      resolvePackagedMacAppBundlePath({
        execPath: '/Applications/Bubbles MVP.app/Contents/MacOS/Bubbles MVP',
        isPackaged: true,
        platform: 'linux'
      })
    ).toEqual({ ok: false, error: 'App uninstall is only available on macOS.' });
  });

  it('moves the packaged app bundle to Trash and quits', async () => {
    const quit = vi.fn();
    const trashItem = vi.fn().mockResolvedValue(undefined);

    await expect(
      movePackagedMacAppToTrash({
        execPath: '/Applications/Bubbles MVP.app/Contents/MacOS/Bubbles MVP',
        isPackaged: true,
        platform: 'darwin',
        quit,
        trashItem
      })
    ).resolves.toEqual({ ok: true });
    expect(trashItem).toHaveBeenCalledWith('/Applications/Bubbles MVP.app');
    expect(quit).toHaveBeenCalled();
  });
});
