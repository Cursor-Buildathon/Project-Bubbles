import { app, ipcMain, shell } from 'electron';
import { copyFile, mkdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';

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

  ipcMain.handle('capabilities:download-artifact', async (_event, input) => {
    const target = parseArtifactTarget(input);

    if (!target) {
      return { ok: false, error: 'Artifact target is missing.' };
    }

    const localArtifact = resolveLocalArtifact(artifactRoot, target);

    if (!localArtifact.ok) {
      return localArtifact;
    }

    const downloadsDir = app.getPath('downloads');
    await mkdir(downloadsDir, { recursive: true });
    const downloadPath = join(downloadsDir, downloadFileName(localArtifact.path, parseArtifactTitle(input)));
    await copyFile(localArtifact.path, downloadPath);

    return { ok: true, path: downloadPath };
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

function parseArtifactTitle(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }

  const title = (input as Record<string, unknown>).title;
  return typeof title === 'string' ? title : undefined;
}

function resolveLocalArtifact(artifactRoot: string, target: string): { ok: true; path: string } | { ok: false; error: string } {
  if (/^https?:\/\//i.test(target)) {
    return { ok: false, error: 'Artifact downloads must use a local artifact path.' };
  }

  const resolvedRoot = resolve(artifactRoot);
  const resolvedTarget = resolve(target);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}/`)) {
    return { ok: false, error: 'Artifact is outside the approved artifact folder.' };
  }

  return { ok: true, path: resolvedTarget };
}

function downloadFileName(sourcePath: string, title: string | undefined) {
  const sourceExt = extname(sourcePath);
  const titleExt = title ? extname(title) : '';
  const rawStem = title ? title.slice(0, title.length - titleExt.length) : basename(sourcePath, sourceExt);
  const stem = sanitizeFileName(rawStem) || 'bubbles-artifact';
  return `${stem}${titleExt || sourceExt || '.dat'}`;
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
