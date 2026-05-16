interface SendableWebContents {
  isDestroyed(): boolean;
  send(channel: string, ...args: unknown[]): void;
}

export interface SendableWindow {
  isDestroyed(): boolean;
  webContents: SendableWebContents;
}

export function sendToWindow(window: SendableWindow | null | undefined, channel: string, ...args: unknown[]) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return false;
  }

  window.webContents.send(channel, ...args);
  return true;
}
