import { redactSecrets } from '../security/redactSecrets.js';
import { type CommandRunner } from '../shared/commandRunner.js';
import { type VerificationResult } from './minimaxApiClient.js';

export interface CliDetectionResult {
  installed: boolean;
  path?: string;
}

export interface MiniMaxCliManager {
  authenticate: (apiKey: string) => Promise<VerificationResult>;
  checkAuthStatus: () => Promise<VerificationResult>;
  checkQuota: () => Promise<VerificationResult>;
  detect: () => Promise<CliDetectionResult>;
  install: () => Promise<VerificationResult>;
  installCommandPreview: string;
  verify: () => Promise<VerificationResult>;
}

interface MiniMaxCliManagerOptions {
  localInstallPrefix?: string;
  useGlobalFallback?: boolean;
  runCommand: CommandRunner;
}

export function createMiniMaxCliManager({
  localInstallPrefix,
  runCommand,
  useGlobalFallback = true
}: MiniMaxCliManagerOptions): MiniMaxCliManager {
  const localBinaryPath = localInstallPrefix ? `${localInstallPrefix}/bin/mmx` : undefined;
  const installArgs = localInstallPrefix
    ? ['install', '--global', '--prefix', localInstallPrefix, 'mmx-cli']
    : ['install', '-g', 'mmx-cli'];
  const installCommandPreview = `npm ${installArgs.map(formatPreviewArg).join(' ')}`;
  let resolvedBinaryPath = localBinaryPath;

  async function runChecked(command: string, args: string[]): Promise<VerificationResult> {
    const result = await runCommand(command, args);

    if (result.exitCode !== 0) {
      return {
        ok: false,
        error: formatCliError(result.stderr || result.stdout || `${command} failed`)
      };
    }

    return { ok: true };
  }

  return {
    installCommandPreview,

    async authenticate(apiKey: string) {
      return runChecked(resolvedBinaryPath ?? 'mmx', ['auth', 'login', '--api-key', apiKey]);
    },

    async checkAuthStatus() {
      return runChecked(resolvedBinaryPath ?? 'mmx', ['auth', 'status', '--output', 'json']);
    },

    async checkQuota() {
      return runChecked(resolvedBinaryPath ?? 'mmx', ['quota']);
    },

    async detect() {
      if (localBinaryPath) {
        const localResult = await runCommand('test', ['-x', localBinaryPath]);

        if (localResult.exitCode === 0) {
          resolvedBinaryPath = localBinaryPath;
          return { installed: true, path: localBinaryPath };
        }
      }

      if (!useGlobalFallback) {
        return { installed: false };
      }

      const result = await runCommand('which', ['mmx']);

      if (result.exitCode !== 0) {
        return { installed: false };
      }

      const path = result.stdout.trim();
      if (!path) {
        return { installed: false };
      }

      resolvedBinaryPath = path;
      return { installed: true, path };
    },

    async install() {
      const result = await runChecked('npm', installArgs);

      if (result.ok && localBinaryPath) {
        resolvedBinaryPath = localBinaryPath;
      }

      return result;
    },

    async verify() {
      return runChecked(resolvedBinaryPath ?? 'mmx', ['text', 'chat', '--message', 'Reply with exactly: ok']);
    }
  };
}

function formatPreviewArg(arg: string) {
  return /\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function formatCliError(rawError: string) {
  const redacted = redactSecrets(rawError);
  const minimaxJsonError = parseMiniMaxJsonError(redacted);

  if (minimaxJsonError) {
    return minimaxJsonError;
  }

  if (/EACCES|permission denied/i.test(redacted)) {
    return 'MiniMax CLI install hit a permissions error. Bubbles installs the CLI in an app-local folder and setup will stay incomplete until mmx is available.';
  }

  if (/API key failed validation against all regions|Detecting region/i.test(redacted)) {
    return 'MiniMax CLI could not validate the Token Plan Key. Setup will stay incomplete until CLI auth works.';
  }

  const compact = redacted.replace(/\s+/g, ' ').trim();
  const maxLength = 320;

  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact;
}

function parseMiniMaxJsonError(rawError: string) {
  try {
    const parsed = JSON.parse(rawError) as { error?: { code?: number; message?: string; hint?: string } };
    const text = `${parsed.error?.code ?? ''} ${parsed.error?.message ?? ''} ${parsed.error?.hint ?? ''}`;

    if (/network|connection|proxy|timeout|ECONN|ENOTFOUND|ETIMEDOUT/i.test(text)) {
      return 'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.';
    }

    if (/auth|unauthori[sz]ed|api key|token|401|403/i.test(text)) {
      return 'MiniMax CLI authentication failed. Recheck the Token Plan key in Settings.';
    }

    if (/quota|limit|429/i.test(text)) {
      return 'MiniMax CLI quota check failed. Review your Token Plan quota, then use Recheck CLI.';
    }
  } catch {
    return undefined;
  }

  return undefined;
}
