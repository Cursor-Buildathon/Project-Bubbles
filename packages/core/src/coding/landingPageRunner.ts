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
      const normalized = normalizeGeneratedFiles(code.files);
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
    const body = await generateJson(createLandingPageCodePrompt(input));
    return parseLandingPageCodeResponse(body);
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

function contentType(filePath: string) {
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }

  if (filePath.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }

  return 'text/html; charset=utf-8';
}
