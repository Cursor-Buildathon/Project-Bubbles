import { createServer, type Server } from 'node:http';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, posix, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { type ArtifactMetadata } from '../shared/types.js';

const allowedGeneratedFilePaths = new Set(['index.html', 'src.css', 'src.js', 'package.json']);
const requiredGeneratedFilePaths = ['index.html', 'src.css', 'package.json'];

export interface LandingPageFile {
  path: string;
  content: string;
}

export interface LandingPageRequest {
  changeRequest?: string;
  previousFiles?: LandingPageFile[];
  request: string;
}

export interface LandingPageCodeInput {
  changeRequest?: string;
  previousFiles?: LandingPageFile[];
  request: string;
}

export type LandingPageCodeGenerator = (input: LandingPageCodeInput) => Promise<{ files: LandingPageFile[] }>;

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
  generateCode: LandingPageCodeGenerator;
  sandboxRoot: string;
}

export function createLandingPageRunner({ generateCode, sandboxRoot }: LandingPageRunnerOptions) {
  return {
    async generate(input: LandingPageRequest): Promise<LandingPageGenerateResult> {
      const siteId = stableSiteId(input.request);
      const siteDir = resolve(sandboxRoot, siteId);
      assertSandboxPath(sandboxRoot, siteDir);
      const code = await generateCode({
        changeRequest: input.changeRequest,
        previousFiles: input.previousFiles,
        request: input.request
      });
      const normalized = repairGeneratedFiles(normalizeGeneratedFiles(code.files), input.request);
      const checks = checkLandingPageFiles(normalized);
      const failed = checks.filter((check) => !check.ok);

      if (failed.length) {
        return {
          ok: false,
          error: failed.map((check) => check.message).join(' '),
          checks
        };
      }

      await rm(siteDir, { recursive: true, force: true });
      await mkdir(join(siteDir, 'scripts'), { recursive: true });

      for (const file of normalized) {
        const filePath = join(siteDir, file.path);
        assertSandboxPath(siteDir, filePath);
        await writeFile(filePath, file.content, 'utf8');
      }

      await writeFile(join(siteDir, 'scripts', 'accessibility-check.mjs'), accessibilityCheckScript(), 'utf8');

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

export function createMiniMaxLandingPageCodeGenerator({
  generateJson
}: {
  generateJson: (prompt: string) => Promise<unknown>;
}): LandingPageCodeGenerator {
  return async (input) => {
    try {
      const body = await generateJson(createLandingPageCodePrompt(input));
      const parsed = parseLandingPageCodeResponse(body);

      if (parsed.files.some((file) => file.path === 'index.html')) {
        return parsed;
      }
    } catch {
      // If MiniMax is slow or returns malformed JSON, keep the user workflow alive with a safe local fallback.
    }

    return createFallbackLandingPageCode(input);
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

function normalizeGeneratedFiles(files: LandingPageFile[]) {
  const normalized: LandingPageFile[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const path = normalizeGeneratedPath(file.path);

    if (!path || !allowedGeneratedFilePaths.has(path)) {
      return [
        {
          path: '__invalid__',
          content: `Generated file path is not allowed: ${file.path}`
        }
      ];
    }

    if (seen.has(path)) {
      return [
        {
          path: '__invalid__',
          content: `Generated file path is duplicated: ${path}`
        }
      ];
    }

    seen.add(path);
    normalized.push({ path, content: file.content });
  }

  return normalized;
}

function normalizeGeneratedPath(path: string) {
  const normalized = posix.normalize(path.replaceAll('\\', '/').replace(/^\.\//, ''));

  if (normalized.startsWith('../') || normalized === '..' || normalized.startsWith('/')) {
    return undefined;
  }

  return normalized;
}

function repairGeneratedFiles(files: LandingPageFile[], request: string) {
  if (files.some((file) => file.path === '__invalid__')) {
    return files;
  }

  const fileMap = new Map(files.map((file) => [file.path, file.content]));
  const html = fileMap.get('index.html');

  if (!html) {
    return files;
  }

  fileMap.set('index.html', repairGeneratedHtml(html, request));
  fileMap.set('src.css', repairGeneratedCss(fileMap.get('src.css') ?? ''));
  fileMap.set('package.json', safeVitePackageJson());

  if (fileMap.has('src.js')) {
    fileMap.set('src.js', stripRemoteJsImports(fileMap.get('src.js') ?? ''));
  }

  return Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }));
}

function repairGeneratedHtml(html: string, request: string) {
  let repaired = html.trim();

  if (!/<!doctype html>/i.test(repaired)) {
    repaired = `<!doctype html>\n${repaired}`;
  }

  if (!/<html\b/i.test(repaired)) {
    const bodyContent = repaired.replace(/<!doctype html>/i, '').trim();
    repaired = `<!doctype html>\n<html lang="en">\n<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(
      landingPageTitle(request)
    )}</title><link rel="stylesheet" href="/src.css" /></head>\n<body>${bodyContent}</body>\n</html>`;
  }

  repaired = repaired.replace(/<html\b([^>]*)>/i, (_match, attrs: string) => {
    const withoutLang = attrs.replace(/\s+lang\s*=\s*["'][^"']*["']/i, '');
    return `<html lang="en"${withoutLang}>`;
  });

  if (!/<meta\s+name=["']viewport["']/i.test(repaired)) {
    repaired = repaired.replace(/<\/head>/i, '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n</head>');
  }

  if (!/<link[^>]+href=["']\/src\.css["']/i.test(repaired)) {
    repaired = repaired.replace(/<\/head>/i, '  <link rel="stylesheet" href="/src.css" />\n</head>');
  }

  repaired = stripRemoteHtmlAssets(repaired);
  repaired = ensurePrimaryHeading(repaired, request);
  repaired = ensureImage(repaired, request);
  repaired = ensureImageAltText(repaired, request);
  repaired = ensureLabeledFormField(repaired);

  return repaired;
}

function ensurePrimaryHeading(html: string, request: string) {
  if (/<h1[\s>]/i.test(html)) {
    return html;
  }

  const heading = `<h1>${escapeHtml(landingPageTitle(request))}</h1>`;
  return injectIntoHtmlBody(html, heading);
}

function ensureImage(html: string, request: string) {
  if (/<img\b/i.test(html)) {
    return html;
  }

  const title = landingPageTitle(request);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#104c5c"/><stop offset="1" stop-color="#f5b85f"/></linearGradient></defs><rect width="1200" height="720" fill="url(#g)"/><circle cx="250" cy="180" r="110" fill="#ffffff" opacity=".18"/><circle cx="950" cy="540" r="180" fill="#ffffff" opacity=".14"/><path d="M120 550 C340 360 500 620 700 420 S960 280 1100 430 V720 H120 Z" fill="#102026" opacity=".42"/><text x="90" y="130" fill="#fff" font-family="Arial, sans-serif" font-size="64" font-weight="700">${escapeSvgText(
    title
  )}</text></svg>`;
  const image = `<img class="bubbles-generated-visual" src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="${escapeHtmlAttribute(
    `${title} landing page visual`
  )}" />`;

  return html.replace(/<\/h1>/i, `</h1>\n${image}`);
}

function ensureImageAltText(html: string, request: string) {
  const altText = escapeHtmlAttribute(`${landingPageTitle(request)} visual`);
  return html.replace(/<img\b(?![^>]*\balt\s*=)([^>]*)>/gi, (_match, attrs: string) => `<img alt="${altText}"${attrs}>`);
}

function ensureLabeledFormField(html: string) {
  if (/<label[\s>]/i.test(html)) {
    return html;
  }

  const form = `<form class="bubbles-contact-form"><label for="bubbles-contact-email">Email</label><input id="bubbles-contact-email" name="email" type="email" placeholder="you@example.com" /><button type="submit">Get started</button></form>`;
  return injectIntoHtmlBody(html, form);
}

function injectIntoHtmlBody(html: string, content: string) {
  if (/<main\b[^>]*>/i.test(html)) {
    return html.replace(/<main\b[^>]*>/i, (match) => `${match}\n${content}`);
  }

  if (/<body\b[^>]*>/i.test(html)) {
    return html.replace(/<body\b[^>]*>/i, (match) => `${match}\n<main>\n${content}\n</main>`);
  }

  return `${html}\n${content}`;
}

function stripRemoteHtmlAssets(html: string) {
  return html
    .replace(/<script\b[^>]*\bsrc=["']https?:\/\/[^"']*["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<link\b[^>]*\bhref=["']https?:\/\/[^"']*(font|typekit|googleapis|gstatic)[^"']*["'][^>]*>/gi, '');
}

function repairGeneratedCss(css: string) {
  const cleaned = css
    .replace(/@import\s+url\(["']?https?:\/\/[^;]+;/gi, '')
    .replace(/@font-face\s*{[^}]*https?:\/\/[^}]*}/gi, '');

  return `${cleaned}

.bubbles-generated-visual {
  display: block;
  width: min(100%, 980px);
  aspect-ratio: 5 / 3;
  object-fit: cover;
  border-radius: 8px;
}

.bubbles-contact-form {
  display: grid;
  gap: 0.75rem;
  max-width: 420px;
}
`;
}

function stripRemoteJsImports(js: string) {
  return js.replace(/^\s*import\s+["']https?:\/\/[^"']+["'];?\s*$/gim, '');
}

function safeVitePackageJson() {
  return JSON.stringify(
    {
      private: true,
      scripts: {
        build: 'vite build',
        dev: 'vite --host 127.0.0.1'
      },
      devDependencies: {
        vite: '^5.4.21'
      }
    },
    null,
    2
  );
}

function checkLandingPageFiles(files: LandingPageFile[]): LandingPageCheck[] {
  const fileMap = new Map(files.map((file) => [file.path, file.content]));
  const invalidFile = files.find((file) => file.path === '__invalid__');
  const html = fileMap.get('index.html') ?? '';
  const css = fileMap.get('src.css') ?? '';
  const js = fileMap.get('src.js') ?? '';
  const packageFile = fileMap.get('package.json') ?? '';

  return [
    {
      name: 'files.allowlist',
      ok: !invalidFile,
      message: invalidFile?.content ?? 'All generated files must stay inside the landing-page allowlist.'
    },
    {
      name: 'files.required',
      ok: requiredGeneratedFilePaths.every((path) => fileMap.has(path)),
      message: `The generated page must include ${requiredGeneratedFilePaths.join(', ')}.`
    },
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
    },
    {
      name: 'security.remote_script',
      ok: !/<script[^>]+src=["']https?:\/\//i.test(html) && !/\bimport\s+["']https?:\/\//i.test(js),
      message: 'Remote scripts are not allowed in generated landing pages.'
    },
    {
      name: 'security.remote_font',
      ok:
        !/<link[^>]+href=["']https?:\/\/[^"']*(font|typekit|googleapis|gstatic)/i.test(html) &&
        !/@import\s+url\(["']?https?:\/\//i.test(css) &&
        !/@font-face[\s\S]*https?:\/\//i.test(css),
      message: 'Remote fonts are not allowed in generated landing pages.'
    },
    {
      name: 'package.safe_vite',
      ok: isSafeVitePackageJson(packageFile),
      message: 'The generated package.json must use only the approved Vite build scripts and dependency.'
    }
  ];
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

function isSafeVitePackageJson(content: string) {
  try {
    const parsed = JSON.parse(content) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
      scripts?: Record<string, unknown>;
    };
    const dependencyNames = Object.keys(parsed.dependencies ?? {});
    const devDependencyNames = Object.keys(parsed.devDependencies ?? {});

    return (
      parsed.scripts?.build === 'vite build' &&
      parsed.scripts?.dev === 'vite --host 127.0.0.1' &&
      dependencyNames.length === 0 &&
      devDependencyNames.length === 1 &&
      devDependencyNames[0] === 'vite'
    );
  } catch {
    return false;
  }
}

function createLandingPageCodePrompt(input: LandingPageCodeInput) {
  const previousFiles = input.previousFiles?.length
    ? `\nPrevious files to revise:\n${input.previousFiles.map((file) => `FILE: ${file.path}\n${file.content}`).join('\n\n')}`
    : '';
  const changeRequest = input.changeRequest ? `\nRevision request: ${input.changeRequest}` : '';

  return `Create a polished static Vite landing page for this user request:
${input.request}${changeRequest}${previousFiles}

Return JSON only with this shape:
{
  "files": [
    { "path": "index.html", "content": "..." },
    { "path": "src.css", "content": "..." },
    { "path": "src.js", "content": "..." },
    { "path": "package.json", "content": "..." }
  ]
}

Rules:
- Use only these file paths: index.html, src.css, src.js, package.json.
- index.html must include <html lang="en">, one <h1>, at least one image with alt text, and a visible labeled form field.
- Link /src.css and optionally /src.js from index.html.
- Remote image URLs are allowed. Remote scripts, remote fonts, and external build dependencies are not allowed.
- package.json must contain scripts build="vite build", dev="vite --host 127.0.0.1", no dependencies, and devDependencies with only vite.
- Make the page visually attractive, responsive, and tailored to the user's idea.`;
}

function landingPageTitle(request: string) {
  const cleaned = request
    .replace(/^bubbles,?\s*/i, '')
    .replace(/^(build|make|create|generate)\s+(me\s+)?(a\s+|an\s+)?/i, '')
    .replace(/^(landing page|webpage|web page|site|website)(\s+(for|about))?\s*/i, '')
    .replace(/\b(landing page|webpage|web page|site|website)\b/gi, '')
    .replace(/[.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || 'Bubbles Landing Page';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replaceAll('\n', ' ');
}

function escapeSvgText(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function parseLandingPageCodeResponse(body: unknown) {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const files = Array.isArray(record.files) ? record.files : [];

  return {
    files: files
      .map((file): LandingPageFile | undefined => {
        if (!file || typeof file !== 'object') {
          return undefined;
        }

        const recordFile = file as Record<string, unknown>;

        if (typeof recordFile.path !== 'string' || typeof recordFile.content !== 'string') {
          return undefined;
        }

        return {
          path: recordFile.path,
          content: recordFile.content
        };
      })
      .filter((file): file is LandingPageFile => Boolean(file))
  };
}

function createFallbackLandingPageCode(input: LandingPageCodeInput) {
  const title = landingPageTitle(input.request);
  const escapedTitle = escapeHtml(title);
  const imageAlt = escapeHtmlAttribute(`${title} product preview`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#071b2c"/><stop offset=".54" stop-color="#155e75"/><stop offset="1" stop-color="#f4b860"/></linearGradient></defs><rect width="1200" height="760" fill="url(#bg)"/><g fill="none" stroke="#ffffff" stroke-opacity=".24" stroke-width="2"><path d="M90 150h1020M90 290h1020M90 430h1020M90 570h1020M230 70v620M430 70v620M630 70v620M830 70v620M1030 70v620"/></g><circle cx="915" cy="235" r="135" fill="#ffffff" opacity=".14"/><circle cx="1015" cy="335" r="74" fill="#ffffff" opacity=".18"/><rect x="110" y="120" width="560" height="390" rx="34" fill="#06131f" opacity=".62"/><text x="155" y="225" fill="#ffffff" font-family="Arial, sans-serif" font-size="62" font-weight="700">${escapeSvgText(
    title
  )}</text><text x="155" y="305" fill="#dff8ff" font-family="Arial, sans-serif" font-size="32">Launch-ready digital presence</text><rect x="155" y="365" width="260" height="58" rx="29" fill="#f4b860"/></svg>`;

  return {
    files: [
      {
        path: 'index.html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapedTitle}</title>
    <link rel="stylesheet" href="/src.css" />
    <script type="module" src="/src.js"></script>
  </head>
  <body>
    <main>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">New venture</p>
          <h1>${escapedTitle}</h1>
          <p class="lead">A polished landing page for a modern startup, built to explain the offer quickly and convert early interest.</p>
          <div class="actions">
            <a href="#contact">Request access</a>
            <span>Fast, focused, and ready to revise.</span>
          </div>
        </div>
        <img class="hero-image" src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="${imageAlt}" />
      </section>
      <section class="proof">
        <article><strong>01</strong><span>Clear positioning</span></article>
        <article><strong>02</strong><span>Responsive layout</span></article>
        <article><strong>03</strong><span>Lead capture built in</span></article>
      </section>
      <section id="contact" class="contact">
        <div>
          <p class="eyebrow">Get started</p>
          <h2>Talk to the team</h2>
        </div>
        <form>
          <label for="email">Email</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" />
          <button type="submit">Join the waitlist</button>
        </form>
      </section>
    </main>
  </body>
</html>`
      },
      {
        path: 'src.css',
        content: `:root {
  color: #102026;
  background: #f7fbfb;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

main {
  min-height: 100vh;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(320px, 1.1fr);
  gap: 40px;
  align-items: center;
  padding: clamp(32px, 6vw, 86px);
  background: linear-gradient(135deg, #f7fbfb 0%, #e8f5f3 48%, #f9ead2 100%);
}

.hero-copy {
  max-width: 680px;
}

.eyebrow {
  margin: 0 0 14px;
  color: #0f766e;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #071b2c;
  font-size: clamp(3rem, 9vw, 6.75rem);
  line-height: 0.92;
}

.lead {
  color: #38535b;
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  line-height: 1.65;
  margin: 28px 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.actions a,
button {
  border: 0;
  border-radius: 8px;
  background: #102026;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 14px 18px;
  text-decoration: none;
}

.actions span {
  color: #60747a;
}

.hero-image {
  width: 100%;
  aspect-ratio: 5 / 3;
  border-radius: 8px;
  box-shadow: 0 28px 70px rgba(16, 32, 38, 0.22);
  object-fit: cover;
}

.proof {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: #d9e6e3;
}

.proof article {
  display: grid;
  gap: 12px;
  min-height: 150px;
  padding: 32px;
  background: #ffffff;
}

.proof strong {
  color: #0f766e;
}

.contact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 460px);
  gap: 32px;
  padding: clamp(32px, 6vw, 72px);
  background: #102026;
  color: #ffffff;
}

.contact h2 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 4rem);
}

form {
  display: grid;
  gap: 12px;
  align-self: center;
}

label {
  font-weight: 800;
}

input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  font: inherit;
  padding: 14px;
}

form button {
  background: #f4b860;
  color: #102026;
}

@media (max-width: 800px) {
  .hero,
  .contact {
    grid-template-columns: 1fr;
  }

  .proof {
    grid-template-columns: 1fr;
  }
}
`
      },
      {
        path: 'src.js',
        content: `document.querySelector('form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  document.documentElement.dataset.waitlist = 'joined';
});`
      },
      {
        path: 'package.json',
        content: safeVitePackageJson()
      }
    ]
  };
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
