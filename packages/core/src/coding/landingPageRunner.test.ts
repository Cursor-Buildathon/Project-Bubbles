import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  assertSandboxPath,
  assertWorkflowCommandsAllowed,
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
    const runner = createLandingPageRunner({ sandboxRoot: root });

    const result = await runner.generate({
      request: 'Build a landing page for a tiny bakery'
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    await expect(readFile(join(result.siteDir, 'index.html'), 'utf8')).resolves.toContain('<html lang="en">');
    await expect(readFile(join(result.siteDir, 'package.json'), 'utf8')).resolves.toContain('"vite"');
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'html.lang', ok: true }),
        expect.objectContaining({ name: 'heading.h1', ok: true })
      ])
    );
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
