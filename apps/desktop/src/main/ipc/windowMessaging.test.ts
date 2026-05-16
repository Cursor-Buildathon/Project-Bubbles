import { describe, expect, it, vi } from 'vitest';
import { sendToWindow, type SendableWindow } from './windowMessaging.js';

function createWindow(options?: { windowDestroyed?: boolean; webContentsDestroyed?: boolean }) {
  const send = vi.fn();
  const window: SendableWindow = {
    isDestroyed: () => options?.windowDestroyed ?? false,
    webContents: {
      isDestroyed: () => options?.webContentsDestroyed ?? false,
      send
    }
  };

  return { send, window };
}

describe('sendToWindow', () => {
  it('sends to live windows', () => {
    const { send, window } = createWindow();

    expect(sendToWindow(window, 'app:state', { ready: true })).toBe(true);

    expect(send).toHaveBeenCalledWith('app:state', { ready: true });
  });

  it('skips destroyed windows without throwing', () => {
    const { send, window } = createWindow({ windowDestroyed: true });

    expect(sendToWindow(window, 'app:state')).toBe(false);

    expect(send).not.toHaveBeenCalled();
  });

  it('skips destroyed webContents without throwing', () => {
    const { send, window } = createWindow({ webContentsDestroyed: true });

    expect(sendToWindow(window, 'app:state')).toBe(false);

    expect(send).not.toHaveBeenCalled();
  });
});
