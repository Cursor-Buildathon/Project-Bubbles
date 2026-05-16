import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createLocalFilesConnector } from './localFilesConnector.js';

describe('createLocalFilesConnector', () => {
  it('reads only files inside approved roots and requires approval for writes', async () => {
    const root = join(tmpdir(), `bubbles-files-${Date.now()}`);
    const path = join(root, 'notes.txt');
    await mkdir(root, { recursive: true });
    await writeFile(path, 'hello from approved folder', 'utf8');
    const connector = createLocalFilesConnector();
    const config = {
      id: 'local-files',
      name: 'Local Files',
      type: 'local_files' as const,
      enabled: true,
      mode: 'real' as const,
      authStatus: 'ready' as const,
      healthStatus: 'healthy' as const,
      allowedAgents: ['coding-agent'],
      requiredApproval: 'preview_sensitive_actions' as const,
      launchConfig: { approvedRoots: [root] },
      updatedAt: '2026-05-14T00:00:00.000Z'
    };

    await expect(connector.read(config, path)).resolves.toEqual({
      ok: true,
      content: 'hello from approved folder'
    });
    await expect(connector.read(config, join(tmpdir(), 'outside.txt'))).resolves.toMatchObject({
      ok: false,
      error: 'File is outside approved folders.'
    });

    const approval = await connector.prepareWrite(config, path, 'updated');

    expect(approval).toMatchObject({
      actionType: 'file_write',
      title: 'Write file',
      preview: { path, nextContent: 'updated' }
    });
    expect(await readFile(path, 'utf8')).toBe('hello from approved folder');
  });
});
