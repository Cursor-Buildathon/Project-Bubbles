import { createServer, type Server } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { type ArtifactMetadata } from '../shared/types.js';

export interface LandingPageRequest {
  request: string;
}

export interface LandingPageCheck {
  name: string;
  ok: boolean;
  message: string;
}

export type LandingPageGenerateResult = {
  ok: true;
  artifact: ArtifactMetadata;
  checks: LandingPageCheck[];
  siteDir: string;
} | {
  ok: false;
  error: string;
  checks: LandingPageCheck[];
};

export interface WorkflowCommand {
  command: string;
  args: string[];
}

interface LandingPageRunnerOptions {
  sandboxRoot: string;
}

export function createLandingPageRunner({ sandboxRoot }: LandingPageRunnerOptions) {
  return {
    async generate(input: LandingPageRequest): Promise<LandingPageGenerateResult> {
      const siteId = stableSiteId(input.request);
      const siteDir = resolve(sandboxRoot, siteId);
      assertSandboxPath(sandboxRoot, siteDir);
      await mkdir(join(siteDir, 'scripts'), { recursive: true });

      const html = landingPageHtml(input.request);
      await writeFile(join(siteDir, 'index.html'), html, 'utf8');
      await writeFile(join(siteDir, 'src.css'), landingPageCss(), 'utf8');
      await writeFile(join(siteDir, 'package.json'), packageJson(), 'utf8');
      await writeFile(join(siteDir, 'scripts', 'accessibility-check.mjs'), accessibilityCheckScript(), 'utf8');

      const checks = checkLandingPageHtml(html);
      const failed = checks.filter((check) => !check.ok);

      if (failed.length) {
        return {
          ok: false,
          error: failed.map((check) => check.message).join(' '),
          checks
        };
      }

      return {
        ok: true,
        artifact: {
          id: `site-${siteId}`,
          kind: 'site',
          path: siteDir,
          title: input.request
        },
        checks,
        siteDir
      };
    }
  };
}

export function assertSandboxPath(sandboxRoot: string, targetPath: string) {
  const root = resolve(sandboxRoot);
  const target = resolve(targetPath);

  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`Path ${target} is outside the sandbox root.`);
  }
}

export function assertWorkflowCommandsAllowed(commands: WorkflowCommand[]) {
  for (const command of commands) {
    const allowedVite = command.command === 'vite' && command.args.length === 1 && command.args[0] === 'build';
    const allowedNode =
      command.command === 'node' &&
      command.args.length === 1 &&
      command.args[0] === 'scripts/accessibility-check.mjs';

    if (!allowedVite && !allowedNode) {
      throw new Error(`Command ${command.command} ${command.args.join(' ')} is not allowed for the landing page sandbox.`);
    }
  }
}

export async function findAvailablePort(
  startPort: number,
  options: { attempts?: number; host?: string; probe?: (port: number, host: string) => Promise<boolean> } = {}
): Promise<number> {
  const attempts = options.attempts ?? 20;
  const host = options.host ?? '127.0.0.1';
  const probe = options.probe ?? canListen;

  for (let offset = 0; offset < attempts; offset += 1) {
    const port = startPort + offset;

    if (await probe(port, host)) {
      return port;
    }
  }

  throw new Error(`No open port found starting at ${startPort}.`);
}

export function createStaticSiteServer(root: string) {
  let server: Server | undefined;

  return {
    async start(port: number, host = '127.0.0.1') {
      server?.close();
      server = createServer((request, response) => {
        const pathname = request.url === '/' || !request.url ? '/index.html' : request.url.split('?')[0] ?? '/index.html';
        const filePath = resolve(root, `.${pathname}`);

        try {
          assertSandboxPath(root, filePath);
        } catch {
          response.writeHead(403);
          response.end('Forbidden');
          return;
        }

        if (!existsSync(filePath)) {
          response.writeHead(404);
          response.end('Not found');
          return;
        }

        response.writeHead(200, { 'Content-Type': contentType(filePath) });
        createReadStream(filePath).pipe(response);
      });

      await new Promise<void>((resolvePromise, reject) => {
        server?.once('error', reject);
        server?.listen(port, host, () => resolvePromise());
      });

      return { url: `http://${host}:${port}` };
    },
    stop() {
      server?.close();
      server = undefined;
    }
  };
}

function canListen(port: number, host: string) {
  const server = createServer();
  return new Promise<boolean>((resolvePromise) => {
    server.once('error', () => resolvePromise(false));
    server.listen(port, host, () => {
      server.close(() => resolvePromise(true));
    });
  });
}

function stableSiteId(request: string) {
  return createHash('sha1').update(request).digest('hex').slice(0, 10);
}

function checkLandingPageHtml(html: string): LandingPageCheck[] {
  return [
    {
      name: 'html.lang',
      ok: /<html\s+lang="en"/i.test(html),
      message: 'The generated page needs an English lang attribute.'
    },
    {
      name: 'heading.h1',
      ok: /<h1[\s>]/i.test(html),
      message: 'The generated page needs one primary heading.'
    },
    {
      name: 'image.alt',
      ok: /<img[^>]+alt="/i.test(html),
      message: 'The generated page needs alt text on images.'
    },
    {
      name: 'label.form',
      ok: /<label[\s>]/i.test(html),
      message: 'The generated page needs a visible form label.'
    }
  ];
}

function landingPageHtml(request: string) {
  const title = titleFromRequest(request);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="/src.css" />
  </head>
  <body>
    <main>
      <section class="hero">
        <div>
          <p class="eyebrow">Local preview</p>
          <h1>${title}</h1>
          <p class="lede">A crisp landing page generated in a sandbox for: ${escapeHtml(request)}</p>
          <a href="#contact" class="button">Start a conversation</a>
        </div>
        <img alt="${title} preview" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420'%3E%3Crect width='640' height='420' fill='%232ec4b6'/%3E%3Ccircle cx='420' cy='150' r='95' fill='%23f6f3df'/%3E%3Cpath d='M70 320h500' stroke='%23102026' stroke-width='22'/%3E%3C/svg%3E" />
      </section>
      <section class="features" aria-label="Highlights">
        <article><h2>Clear promise</h2><p>Lead with the offer and reduce decision friction.</p></article>
        <article><h2>Fast scan</h2><p>Short sections make the page easy to review.</p></article>
        <article><h2>Ready to refine</h2><p>Ask Bubbles for copy, layout, or color changes.</p></article>
      </section>
      <form id="contact" class="contact">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" />
        <button type="submit">Request details</button>
      </form>
    </main>
  </body>
</html>
`;
}

function landingPageCss() {
  return `:root { color: #102026; background: #f7f7ee; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; }
main { min-height: 100vh; }
.hero { align-items: center; display: grid; gap: 48px; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr); padding: 72px clamp(24px, 6vw, 96px) 40px; }
.eyebrow { color: #586f6b; font-size: 0.82rem; font-weight: 700; letter-spacing: 0; text-transform: uppercase; }
h1 { font-size: clamp(2.4rem, 6vw, 5.5rem); line-height: 0.95; margin: 0; max-width: 820px; }
.lede { color: #314541; font-size: 1.2rem; line-height: 1.55; max-width: 620px; }
.button, button { background: #102026; border: 0; color: #fff; display: inline-flex; font-weight: 700; padding: 14px 18px; text-decoration: none; }
img { border-radius: 8px; max-width: 100%; }
.features { background: #102026; color: #f7f7ee; display: grid; gap: 1px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.features article { padding: 28px; }
.features h2 { font-size: 1rem; }
.contact { display: grid; gap: 10px; max-width: 460px; padding: 40px clamp(24px, 6vw, 96px); }
input { border: 1px solid #b7c4bd; font: inherit; padding: 12px; }
@media (max-width: 760px) { .hero, .features { grid-template-columns: 1fr; } }
`;
}

function packageJson() {
  return `${JSON.stringify({ private: true, scripts: { build: 'vite build', dev: 'vite --host 127.0.0.1' }, devDependencies: { vite: '^5.4.21' } }, null, 2)}\n`;
}

function accessibilityCheckScript() {
  return `import { readFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const checks = [
  ['html.lang', /<html\\s+lang="en"/i],
  ['heading.h1', /<h1[\\s>]/i],
  ['image.alt', /<img[^>]+alt="/i],
  ['label.form', /<label[\\s>]/i]
];
const failed = checks.filter(([, pattern]) => !pattern.test(html));
if (failed.length) {
  console.error('Accessibility checks failed: ' + failed.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log('Accessibility checks passed.');
`;
}

function titleFromRequest(request: string) {
  return escapeHtml(request.replace(/^(build|make|create|generate)\s+(a\s+)?(landing page|webpage|web page|site|website)\s+(for|about)?\s*/i, '').trim() || 'Sandbox Landing Page');
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function contentType(filePath: string) {
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }

  if (filePath.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }

  return 'text/html; charset=utf-8';
}
