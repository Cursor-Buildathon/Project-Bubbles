import { app, ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  createMiniMaxCliManager,
  createMiniMaxSetupService,
  redactSecrets,
  type CommandResult,
  type MiniMaxSetupService,
  type SecureKeyStore,
  type SetupStatus,
  type SetupStatusStore
} from '@bubbles/core';

interface RegisterSetupIpcOptions {
  keyStore: Pick<
    SecureKeyStore,
    | 'deleteAllMiniMaxKeys'
    | 'deleteGeneralApiKey'
    | 'deleteTokenPlanKey'
    | 'getGeneralApiKey'
    | 'getTokenPlanKey'
    | 'setGeneralApiKey'
    | 'setTokenPlanKey'
  >;
  onStatusChange?: (status: SetupStatus) => void;
}

export function registerSetupIpc({ keyStore, onStatusChange }: RegisterSetupIpcOptions): MiniMaxSetupService {
  const runCommand = createProcessRunner();
  const minimaxCliPrefix = join(app.getPath('userData'), 'tools', 'mmx-cli');
  const service = createMiniMaxSetupService({
    apiClient: (apiKey) => import('@bubbles/core').then(({ verifyMiniMaxApiKey }) => verifyMiniMaxApiKey(apiKey)),
    cliManager: createMiniMaxCliManager({
      runCommand,
      localInstallPrefix: minimaxCliPrefix,
      useGlobalFallback: false
    }),
    keyStore,
    statusStore: createJsonSetupStatusStore(join(app.getPath('userData'), 'minimax-setup-status.json'))
  });

  async function updateStatus(action: () => Promise<SetupStatus>) {
    const status = await action();
    onStatusChange?.(status);
    return status;
  }

  ipcMain.handle('setup:get-status', () => service.getStatus());
  ipcMain.handle('setup:save-general-api-key', async (_event, apiKey: string) =>
    updateStatus(() => service.saveGeneralApiKey(apiKey))
  );
  ipcMain.handle('setup:save-token-plan-key', async (_event, apiKey: string) =>
    updateStatus(() => service.saveTokenPlanKey(apiKey))
  );
  ipcMain.handle('setup:install-cli', () => updateStatus(() => service.installCli()));
  ipcMain.handle('setup:retry', () => updateStatus(() => service.retry()));
  ipcMain.handle('setup:reset-general-api-key', () => updateStatus(() => service.resetGeneralApiKey()));
  ipcMain.handle('setup:reset-token-plan-key', () => updateStatus(() => service.resetTokenPlanKey()));
  ipcMain.handle('setup:reset-all-minimax', () => updateStatus(() => service.resetAllMiniMax()));

  return service;
}

export function createProcessRunner() {
  return (command: string, args: string[]): Promise<CommandResult> =>
    new Promise((resolve) => {
      const child = spawn(command, args, {
        env: process.env,
        shell: false,
        windowsHide: true
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => {
        resolve({
          stdout: '',
          stderr: redactSecrets(error),
          exitCode: 1
        });
      });
      child.on('close', (exitCode) => {
        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? 1
        });
      });
    });
}

function createJsonSetupStatusStore(filePath: string): SetupStatusStore {
  return {
    async read() {
      try {
        const raw = await readFile(filePath, 'utf8');
        return JSON.parse(raw) as SetupStatus;
      } catch {
        return undefined;
      }
    },

    async write(status) {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
    }
  };
}
