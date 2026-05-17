import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import {
  assertSandboxPath,
  assertWorkflowCommandsAllowed,
  type LandingPageCodeGenerator,
  createLandingPageRunner,
  createMiniMaxLandingPageCodeGenerator,
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

  it('repairs common generated HTML omissions before sandbox checks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bubbles-landing-'));
    const runner = createLandingPageRunner({
      sandboxRoot: root,
      generateCode: vi.fn<LandingPageCodeGenerator>().mockResolvedValue({
        files: [
          {
            path: 'index.html',
            content: `<!doctype html>
<html>
  <head><title>Startup</title></head>
  <body>
    <main>
      <h1>Launch faster</h1>
      <img src="https://images.example/startup.jpg" />
    </main>
  </body>
</html>`
          },
          { path: 'src.css', content: 'body { margin: 0; }' },
          { path: 'package.json', content: '{}' }
        ]
      })
    });

    const result = await runner.generate({
      request: 'Create me a techy startup webpage'
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const html = await readFile(join(result.siteDir, 'index.html'), 'utf8');
    const css = await readFile(join(result.siteDir, 'src.css'), 'utf8');
    const packageJson = await readFile(join(result.siteDir, 'package.json'), 'utf8');

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('alt="techy startup visual"');
    expect(html).toContain('<label for="bubbles-contact-email">Email</label>');
    expect(css).toContain('.bubbles-contact-form');
    expect(packageJson).toContain('"build": "vite build"');
  });

  it('adds a fallback visual when generated HTML omits images', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bubbles-landing-'));
    const runner = createLandingPageRunner({
      sandboxRoot: root,
      generateCode: vi.fn<LandingPageCodeGenerator>().mockResolvedValue({
        files: [
          {
            path: 'index.html',
            content: '<section><p>Fast launch copy.</p></section>'
          }
        ]
      })
    });

    const result = await runner.generate({
      request: 'Create a landing page for Nova Cloud'
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const html = await readFile(join(result.siteDir, 'index.html'), 'utf8');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<h1>Nova Cloud</h1>');
    expect(html).toContain('src="data:image/svg+xml,');
    expect(html).toContain('alt="Nova Cloud landing page visual"');
  });

  it('opens a safe fallback page when MiniMax code generation times out', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bubbles-landing-'));
    const runner = createLandingPageRunner({
      sandboxRoot: root,
      generateCode: createMiniMaxLandingPageCodeGenerator({
        generateJson: vi.fn().mockRejectedValue(new Error('MiniMax API request timed out. Please try again.'))
      })
    });

    const result = await runner.generate({
      request: 'Bubbles, create me a techy startup webpage.'
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const html = await readFile(join(result.siteDir, 'index.html'), 'utf8');
    const css = await readFile(join(result.siteDir, 'src.css'), 'utf8');

    expect(html).toContain('<title>techy startup</title>');
    expect(html).toContain('alt="techy startup product preview"');
    expect(html).toContain('<label for="email">Email</label>');
    expect(css).toContain('.hero');
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

  it('strips unsafe remote scripts and fonts while allowing remote images', async () => {
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

    const result = await runner.generate({ request: 'Create a page with unsafe remote assets' });
    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const html = await readFile(join(result.siteDir, 'index.html'), 'utf8');
    const css = await readFile(join(result.siteDir, 'src.css'), 'utf8');

    expect(html).not.toContain('https://cdn.example/app.js');
    expect(css).not.toContain('https://fonts.example/font.css');
    expect(html).toContain('https://images.example/photo.jpg');
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
