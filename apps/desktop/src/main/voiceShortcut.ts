export const VOICE_SHORTCUT_ACCELERATOR = 'CommandOrControl+Shift+Space';
export const VOICE_SHORTCUT_CHANNEL = 'voice:shortcut-start';

interface ShortcutRegistrar {
  register: (accelerator: string, callback: () => void) => boolean;
  unregister: (accelerator: string) => void;
}

interface ShortcutWindow {
  focus?: () => void;
  isDestroyed: () => boolean;
  webContents: {
    isDestroyed: () => boolean;
    isLoading?: () => boolean;
    once?: (event: 'did-finish-load', callback: () => void) => void;
    send: (channel: string, ...args: unknown[]) => void;
  };
}

interface RegisterVoiceShortcutOptions {
  accelerator?: string;
  createPanelWindow: () => ShortcutWindow | null | undefined;
  enabled: boolean;
  getPanelWindow: () => ShortcutWindow | null | undefined;
  onRegistrationFailed?: (accelerator: string) => void;
  sendShortcutStart: (window: ShortcutWindow | null | undefined) => boolean;
  shortcut: ShortcutRegistrar;
}

export function registerVoiceShortcut({
  accelerator = VOICE_SHORTCUT_ACCELERATOR,
  createPanelWindow,
  enabled,
  getPanelWindow,
  onRegistrationFailed,
  sendShortcutStart,
  shortcut
}: RegisterVoiceShortcutOptions) {
  if (!enabled) {
    return false;
  }

  const registered = shortcut.register(accelerator, () => {
    const panelWindow = getPanelWindow() ?? createPanelWindow();

    if (!panelWindow || panelWindow.isDestroyed()) {
      return;
    }

    panelWindow.focus?.();

    if (panelWindow.webContents.isLoading?.() && panelWindow.webContents.once) {
      panelWindow.webContents.once('did-finish-load', () => {
        sendShortcutStart(panelWindow);
      });
      return;
    }

    sendShortcutStart(panelWindow);
  });

  if (!registered) {
    onRegistrationFailed?.(accelerator);
  }

  return registered;
}

export function unregisterVoiceShortcut(shortcut: ShortcutRegistrar, accelerator = VOICE_SHORTCUT_ACCELERATOR) {
  shortcut.unregister(accelerator);
}
