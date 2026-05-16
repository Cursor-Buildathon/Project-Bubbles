import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import {
  assertSandboxPath,
  assertWorkflowCommandsAllowed,
  type LandingPageCodeGenerator,
  createLandingPageRunner,
  findAvailablePort
} from './landingPageRunner.js';

describe('landingPageRunner', () => {
  it('rejects writes outside the sandbox root', () => {
    expect(() => assertSandboxPath('/tmp/bubbles-sandbox', '/tmp/bubbles-sandbox/site/index.html')).not.toThrow();
    expect(() => assertSandboxPath('/tmp/bubbles-sandbox', '/tmp/other-site/index.html')).toThrow(/outside the sandbox/);
  });

  it('enforces the approved command allowlist', () => {
    expect(() =>
      assertWorkflowCommandsAllowed([
        { command: 'vite', args: ['build'] },
        { command: 'node', args: ['scripts/accessibility-check.mjs'] }
      ])
    ).not.toThrow();
    expect(() => assertWorkflowCommandsAllowed([{ command: 'rm', args: ['-rf', '/tmp/site'] }])).toThrow(/not allowed/);
  });

  it('generates a checked landing page sandbox', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bubbles-landing-'));
    const generateCode = vi.fn<LandingPageCodeGenerator>().mockResolvedValue({
      files: [
        {
          path: 'index.html',
          content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tiny Bakery</title>
    <link rel="stylesheet" href="/src.css" />
  </head>
  <body>
    <main>
      <h1>Tiny Bakery</h1>
      <img src="https://images.example/bakery.jpg" alt="Fresh pastries on a bakery counter" />
      <form><label for="email">Email</label><input id="email" type="email" /></form>
    </main>
  </body>
</html>`
        },
        { path: 'src.css', content: 'body { margin: 0; font-family: system-ui, sans-serif; }' },
        { path: 'src.js', content: 'document.documentElement.dataset.ready = "true";' },
        {
          path: 'package.json',
          content: JSON.stringify({ private: true, scripts: { build: 'vite build', dev: 'vite --host 127.0.0.1' }, devDependencies: { vite: '^5.4.21' } })
        }
      ]
    });
    const runner = createLandingPageRunner({ sandboxRoot: root, generateCode });

    const result = await runner.generate({
      request: 'Build a landing page for a tiny bakery'
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    await expect(readFile(join(result.siteDir, 'index.html'), 'utf8')).resolves.toContain('<html lang="en">');
    await expect(readFile(join(result.siteDir, 'src.js'), 'utf8')).resolves.toContain('dataset.ready');
    await expect(readFile(join(result.siteDir, 'package.json'), 'utf8')).resolves.toContain('"vite"');
    expect(generateCode).toHaveBeenCalledWith({
      changeRequest: undefined,
      previousFiles: undefined,
      request: 'Build a landing page for a tiny bakery'
    });
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'html.lang', ok: true }),
        expect.objectContaining({ name: 'heading.h1', ok: true })
      ])
    );
  });

  it('rejects generated files outside the landing-page allowlist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bubbles-landing-'));
    const runner = createLandingPageRunner({
      sandboxRoot: root,
      generateCode: vi.fn<LandingPageCodeGenerator>().mockResolvedValue({
        files: [{ path: '../escape.html', content: '<html lang="en"></html>' }]
      })
    });

    await expect(runner.generate({ request: 'Create a page that escapes' })).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('Generated file path is not allowed')
    });
  });

  it('rejects remote scripts and fonts while allowing remote images', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bubbles-landing-'));
    const runner = createLandingPageRunner({
      sandboxRoot: root,
      generateCode: vi.fn<LandingPageCodeGenerator>().mockResolvedValue({
        files: [
          {
            path: 'index.html',
            content: `<!doctype html><html lang="en"><body><h1>Remote script</h1><img src="https://images.example/photo.jpg" alt="Photo" /><script src="https://cdn.example/app.js"></script><form><label for="email">Email</label><input id="email" /></form></body></html>`
          },
          { path: 'src.css', content: "@import url('https://fonts.example/font.css');" },
          {
            path: 'package.json',
            content: JSON.stringify({ private: true, scripts: { build: 'vite build', dev: 'vite --host 127.0.0.1' }, devDependencies: { vite: '^5.4.21' } })
          }
        ]
      })
    });

    await expect(runner.generate({ request: 'Create a page with unsafe remote assets' })).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('Remote scripts are not allowed')
    });
  });

  it('passes previous files and change requests into revision generation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bubbles-landing-'));
    const generateCode = vi.fn<LandingPageCodeGenerator>().mockResolvedValue({
      files: [
        {
          path: 'index.html',
          content: '<!doctype html><html lang="en"><body><h1>Darker Bakery</h1><img src="/hero.svg" alt="Hero" /><form><label for="email">Email</label><input id="email" /></form></body></html>'
        },
        { path: 'src.css', content: 'body { background: #111; color: white; }' },
        {
          path: 'package.json',
          content: JSON.stringify({ private: true, scripts: { build: 'vite build', dev: 'vite --host 127.0.0.1' }, devDependencies: { vite: '^5.4.21' } })
        }
      ]
    });
    const runner = createLandingPageRunner({ sandboxRoot: root, generateCode });

    await expect(
      runner.generate({
        request: 'Build a landing page for a tiny bakery',
        changeRequest: 'Make the hero darker',
        previousFiles: [{ path: 'index.html', content: '<html lang="en"><body><h1>Tiny Bakery</h1></body></html>' }]
      })
    ).resolves.toMatchObject({ ok: true });
    expect(generateCode).toHaveBeenCalledWith({
      changeRequest: 'Make the hero darker',
      previousFiles: [{ path: 'index.html', content: '<html lang="en"><body><h1>Tiny Bakery</h1></body></html>' }],
      request: 'Build a landing page for a tiny bakery'
    });
  });

  it('chooses the first available port from a range', async () => {
    await expect(
      findAvailablePort(4173, {
        attempts: 3,
        host: '127.0.0.1',
        probe: async (port) => port === 4175
      })
    ).resolves.toBe(4175);
  });
});
