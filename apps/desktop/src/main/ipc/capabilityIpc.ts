import { ipcMain, shell } from 'electron';
import { resolve } from 'node:path';

interface RegisterCapabilityIpcOptions {
  artifactRoot: string;
}

export function registerCapabilityIpc({ artifactRoot }: RegisterCapabilityIpcOptions) {
  ipcMain.handle('capabilities:open-artifact', async (_event, input) => {
    const target = parseArtifactTarget(input);

    if (!target) {
      return { ok: false, error: 'Artifact target is missing.' };
    }

    if (/^https?:\/\//i.test(target)) {
      await shell.openExternal(target);
      return { ok: true };
    }

    const resolvedRoot = resolve(artifactRoot);
    const resolvedTarget = resolve(target);

    if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}/`)) {
      return { ok: false, error: 'Artifact is outside the approved artifact folder.' };
    }

    const result = await shell.openPath(resolvedTarget);
    return result ? { ok: false, error: result } : { ok: true };
  });
}

function parseArtifactTarget(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const target = record.url ?? record.path;
  return typeof target === 'string' ? target : undefined;
}
