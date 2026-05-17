import { ipcMain } from 'electron';
import { type TavilySetupService } from '@bubbles/core';

export function registerTavilySetupIpc(service: TavilySetupService) {
  ipcMain.handle('tavily:get-status', () => service.getStatus());
  ipcMain.handle('tavily:retry', () => service.retry());
  ipcMain.handle('tavily:reset-api-key', () => service.resetApiKey());
  ipcMain.handle('tavily:save-api-key', (_event, apiKey: string) => service.saveApiKey(apiKey));
}
