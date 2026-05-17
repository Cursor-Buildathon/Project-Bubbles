import { describe, expect, it, vi } from 'vitest';
import { registerVoiceShortcut, unregisterVoiceShortcut, VOICE_SHORTCUT_ACCELERATOR } from './voiceShortcut.js';

describe('registerVoiceShortcut', () => {
  it('registers the voice shortcut and sends the panel start event', () => {
    let shortcutCallback: (() => void) | undefined;
    const shortcut = {
      register: vi.fn((_accelerator: string, callback: () => void) => {
        shortcutCallback = callback;
        return true;
      }),
      unregister: vi.fn()
    };
    const panelWindow = createTestPanelWindow();
    const createPanel = vi.fn(() => panelWindow);
    const sendShortcutStart = vi.fn(() => true);

    expect(
      registerVoiceShortcut({
        createPanelWindow: createPanel,
        enabled: true,
        getPanelWindow: () => undefined,
        sendShortcutStart,
        shortcut
      })
    ).toBe(true);

    expect(shortcut.register).toHaveBeenCalledWith(VOICE_SHORTCUT_ACCELERATOR, expect.any(Function));

    shortcutCallback?.();

    expect(createPanel).toHaveBeenCalledTimes(1);
    expect(panelWindow.focus).toHaveBeenCalledTimes(1);
    expect(sendShortcutStart).toHaveBeenCalledWith(panelWindow);
  });

  it('waits for a newly-loading panel before sending the shortcut event', () => {
    let finishLoadCallback: (() => void) | undefined;
    let shortcutCallback: (() => void) | undefined;
    const shortcut = {
      register: vi.fn((_accelerator: string, callback: () => void) => {
        shortcutCallback = callback;
        return true;
      }),
      unregister: vi.fn()
    };
    const panelWindow = createTestPanelWindow({
      isLoading: () => true,
      once: vi.fn((_event: 'did-finish-load', callback: () => void) => {
        finishLoadCallback = callback;
      })
    });
    const sendShortcutStart = vi.fn(() => true);

    registerVoiceShortcut({
      createPanelWindow: vi.fn(() => panelWindow),
      enabled: true,
      getPanelWindow: () => undefined,
      sendShortcutStart,
      shortcut
    });

    shortcutCallback?.();

    expect(sendShortcutStart).not.toHaveBeenCalled();

    finishLoadCallback?.();

    expect(sendShortcutStart).toHaveBeenCalledWith(panelWindow);
  });

  it('reports failed registration without throwing', () => {
    const onRegistrationFailed = vi.fn();
    const shortcut = {
      register: vi.fn(() => false),
      unregister: vi.fn()
    };

    expect(
      registerVoiceShortcut({
        createPanelWindow: vi.fn(),
        enabled: true,
        getPanelWindow: () => undefined,
        onRegistrationFailed,
        sendShortcutStart: vi.fn(),
        shortcut
      })
    ).toBe(false);
    expect(onRegistrationFailed).toHaveBeenCalledWith(VOICE_SHORTCUT_ACCELERATOR);
  });

  it('unregisters the voice shortcut', () => {
    const shortcut = {
      register: vi.fn(),
      unregister: vi.fn()
    };

    unregisterVoiceShortcut(shortcut);

    expect(shortcut.unregister).toHaveBeenCalledWith(VOICE_SHORTCUT_ACCELERATOR);
  });
});

function createTestPanelWindow(
  webContents: {
    isDestroyed?: () => boolean;
    isLoading?: () => boolean;
    once?: (event: 'did-finish-load', callback: () => void) => void;
  } = {}
) {
  return {
    focus: vi.fn(),
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: vi.fn(),
      ...webContents
    }
  };
}
