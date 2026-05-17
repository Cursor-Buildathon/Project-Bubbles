export interface AppLifecycleResult {
  ok: boolean;
  error?: string;
}

export interface ResolvedMacAppBundle extends AppLifecycleResult {
  appBundlePath?: string;
}

interface ResolveMacAppBundleInput {
  execPath: string;
  isPackaged: boolean;
  platform: NodeJS.Platform;
}

interface MoveMacAppToTrashInput extends ResolveMacAppBundleInput {
  quit: () => void;
  trashItem: (path: string) => Promise<void>;
}

export function resolvePackagedMacAppBundlePath({
  execPath,
  isPackaged,
  platform
}: ResolveMacAppBundleInput): ResolvedMacAppBundle {
  if (platform !== 'darwin') {
    return { ok: false, error: 'App uninstall is only available on macOS.' };
  }

  if (!isPackaged) {
    return { ok: false, error: 'Move to Trash is available only from the packaged macOS app.' };
  }

  const match = execPath.match(/^(.*?\.app)(?:\/Contents\/MacOS(?:\/.*)?)?$/);

  if (!match?.[1]) {
    return { ok: false, error: 'Could not locate the packaged app bundle.' };
  }

  return { ok: true, appBundlePath: match[1] };
}

export async function movePackagedMacAppToTrash(input: MoveMacAppToTrashInput): Promise<AppLifecycleResult> {
  const resolved = resolvePackagedMacAppBundlePath(input);

  if (!resolved.ok || !resolved.appBundlePath) {
    return { ok: false, error: resolved.error };
  }

  try {
    await input.trashItem(resolved.appBundlePath);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not move the app to Trash.'
    };
  }

  input.quit();
  return { ok: true };
}
