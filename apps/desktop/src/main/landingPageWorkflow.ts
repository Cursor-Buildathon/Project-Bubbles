import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type LandingPageFile } from '@bubbles/core';

export const landingPageMetadataFile = '.bubbles-landing-page.json';

interface CopyManagedLandingPageProjectInput {
  downloadsRoot: string;
  request: string;
  sourceDir: string;
}

export interface CopyManagedLandingPageProjectResult {
  outputDir: string;
  projectName: string;
}

export async function copyManagedLandingPageProject({
  downloadsRoot,
  request,
  sourceDir
}: CopyManagedLandingPageProjectInput): Promise<CopyManagedLandingPageProjectResult> {
  await mkdir(downloadsRoot, { recursive: true });
  const projectName = sanitizeLandingPageProjectName(request);
  const outputDir = await resolveManagedOutputDir(downloadsRoot, projectName);

  if (existsSync(outputDir)) {
    await rm(outputDir, { recursive: true, force: true });
  }

  await cp(sourceDir, outputDir, { recursive: true });
  await writeFile(
    join(outputDir, landingPageMetadataFile),
    JSON.stringify({ generatedAt: new Date().toISOString(), kind: 'landing-page', managedBy: 'bubbles', request }),
    'utf8'
  );

  return { outputDir, projectName };
}

export function sanitizeLandingPageProjectName(request: string) {
  const idea = request
    .replace(/^(build|make|create|generate)\s+(a\s+)?(landing page|webpage|web page|site|website)(\s+(for|about))?\s*/i, '')
    .trim();
  const sanitized = idea
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/[.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  return sanitized || 'Bubbles Landing Page';
}

export function isLandingPageRevisionPrompt(userText: string, hasActiveLandingPage: boolean) {
  if (!hasActiveLandingPage) {
    return false;
  }

  const text = userText.toLowerCase();

  if (/\b(research|search|look up|find sources?|image|video|music|song|agent|code this repo|fix this repo)\b/.test(text)) {
    return false;
  }

  return /\b(change|make|update|add|remove|replace|edit|tweak|adjust|revise|redo|use|switch|move|turn)\b/.test(text);
}

export async function readLandingPageProjectFiles(projectDir: string): Promise<LandingPageFile[]> {
  const paths = ['index.html', 'src.css', 'src.js', 'package.json'];
  const files = await Promise.all(
    paths.map(async (path) => {
      try {
        return {
          path,
          content: await readFile(join(projectDir, path), 'utf8')
        };
      } catch {
        return undefined;
      }
    })
  );

  return files.filter((file): file is LandingPageFile => Boolean(file));
}

async function resolveManagedOutputDir(downloadsRoot: string, projectName: string) {
  const preferred = join(downloadsRoot, projectName);

  if (!existsSync(preferred) || (await isManagedLandingPageDir(preferred))) {
    return preferred;
  }

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = join(downloadsRoot, `${projectName} ${suffix}`);

    if (!existsSync(candidate) || (await isManagedLandingPageDir(candidate))) {
      return candidate;
    }
  }

  return join(downloadsRoot, `${projectName} ${Date.now()}`);
}

async function isManagedLandingPageDir(dir: string) {
  try {
    const metadata = JSON.parse(await readFile(join(dir, landingPageMetadataFile), 'utf8')) as {
      kind?: string;
      managedBy?: string;
    };
    return metadata.kind === 'landing-page' && metadata.managedBy === 'bubbles';
  } catch {
    return false;
  }
}
