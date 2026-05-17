import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  copyManagedLandingPageProject,
  isLandingPageRevisionPrompt,
  landingPageMetadataFile,
  readLandingPageProjectFiles,
  sanitizeLandingPageProjectName
} from './landingPageWorkflow.js';

async function makeTempDir(prefix: string) {
  return mkdtemp(join(tmpdir(), prefix));
}

async function makeSourceProject() {
  const sourceDir = await makeTempDir('bubbles-site-source-');
  await mkdir(join(sourceDir, 'dist'), { recursive: true });
  await writeFile(join(sourceDir, 'index.html'), '<html lang="en"><body><h1>New page</h1></body></html>', 'utf8');
  await writeFile(join(sourceDir, 'src.css'), 'body { color: #102026; }', 'utf8');
  await writeFile(join(sourceDir, 'dist', 'index.html'), '<h1>Built page</h1>', 'utf8');
  return sourceDir;
}

describe('landingPageWorkflow', () => {
  it('sanitizes landing-page project names from the user request', () => {
    expect(sanitizeLandingPageProjectName('Create a landing page for Tiny Bakery!')).toBe('Tiny Bakery');
    expect(sanitizeLandingPageProjectName('create a webpage')).toBe('Bubbles Landing Page');
  });

  it('overwrites managed Downloads folders when saving a revised landing page', async () => {
    const downloadsRoot = await makeTempDir('bubbles-downloads-');
    const sourceDir = await makeSourceProject();
    const managedDir = join(downloadsRoot, 'Tiny Bakery');
    await mkdir(managedDir, { recursive: true });
    await writeFile(join(managedDir, landingPageMetadataFile), JSON.stringify({ managedBy: 'bubbles', kind: 'landing-page' }), 'utf8');
    await writeFile(join(managedDir, 'old.html'), 'old', 'utf8');

    const result = await copyManagedLandingPageProject({
      downloadsRoot,
      request: 'Create a landing page for Tiny Bakery',
      sourceDir
    });

    expect(result.outputDir).toBe(managedDir);
    await expect(readFile(join(managedDir, 'index.html'), 'utf8')).resolves.toContain('New page');
    await expect(readFile(join(managedDir, 'old.html'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(managedDir, landingPageMetadataFile), 'utf8')).resolves.toContain('"kind":"landing-page"');
  });

  it('uses a suffixed Downloads folder rather than overwriting an unmanaged folder', async () => {
    const downloadsRoot = await makeTempDir('bubbles-downloads-');
    const sourceDir = await makeSourceProject();
    const unmanagedDir = join(downloadsRoot, 'Tiny Bakery');
    await mkdir(unmanagedDir, { recursive: true });
    await writeFile(join(unmanagedDir, 'user-file.txt'), 'keep me', 'utf8');

    const result = await copyManagedLandingPageProject({
      downloadsRoot,
      request: 'Create a landing page for Tiny Bakery',
      sourceDir
    });

    expect(result.outputDir).toBe(join(downloadsRoot, 'Tiny Bakery 2'));
    await expect(readFile(join(unmanagedDir, 'user-file.txt'), 'utf8')).resolves.toBe('keep me');
    await expect(readFile(join(result.outputDir, 'index.html'), 'utf8')).resolves.toContain('New page');
  });

  it('reads editable landing-page source files for revision prompts', async () => {
    const sourceDir = await makeSourceProject();

    await expect(readLandingPageProjectFiles(sourceDir)).resolves.toEqual(
      expect.arrayContaining([
        { path: 'index.html', content: expect.stringContaining('New page') },
        { path: 'src.css', content: expect.stringContaining('color') }
      ])
    );
  });

  it('recognizes follow-up wording as revisions only when a landing page is active', () => {
    expect(isLandingPageRevisionPrompt('make the hero darker', true)).toBe(true);
    expect(isLandingPageRevisionPrompt('add a pricing section', true)).toBe(true);
    expect(isLandingPageRevisionPrompt('research bakeries', true)).toBe(false);
    expect(isLandingPageRevisionPrompt('make the hero darker', false)).toBe(false);
  });
});
