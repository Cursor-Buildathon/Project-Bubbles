#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', 'node_modules', 'out', 'dist', 'coverage', 'output']);
const args = new Set(process.argv.slice(2));
const productionRoots = [
  'apps',
  'packages',
  'agents',
  ...(args.has('--include-docs') ? ['docs'] : []),
  ...(args.has('--include-skills') ? ['.codex/skills'] : [])
];

const signalGroups = [
  {
    name: 'explicit fixture switch',
    patterns: [/fixture/i, /BUBBLES_MINIMAX_MEDIA_FIXTURE/]
  },
  {
    name: 'static demo UI',
    patterns: [/Phase 1 demo/, /Sprite states/, /Local preview/, /live demo/i, /I heard:/]
  },
  {
    name: 'stub or availability copy',
    patterns: [/^\s*\.\.\.\s*$/, /not ready yet/i, /unavailable/i]
  },
  {
    name: 'removed legacy path mention',
    patterns: [/MiniMax CLI/i, /mcp:search-fixture/i, /Google Workspace/i, /Gmail/i, /Calendar/i, /Local Files/i]
  }
];

function walk(dir, files = []) {
  if (!existsSync(dir)) {
    return files;
  }

  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry) || entry === '.DS_Store') {
      continue;
    }

    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      walk(path, files);
    } else if (/\.(ts|tsx|js|mjs|json|md|yaml|yml|css)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function relativePath(path) {
  return relative(root, path);
}

function collectSignals() {
  const files = productionRoots.flatMap((dir) => walk(join(root, dir)));
  const signals = [];

  for (const file of files) {
    if (!args.has('--include-tests') && /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(file)) {
      continue;
    }

    const lines = read(file).split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const group of signalGroups) {
        if (group.patterns.some((pattern) => pattern.test(line))) {
          signals.push({
            category: group.name,
            line: index + 1,
            path: relativePath(file),
            text: line.trim().replace(/\s+/g, ' ')
          });
        }
      }
    });
  }

  return signals;
}

function parseAgentTools() {
  const agentsDir = join(root, 'agents');
  return walk(agentsDir)
    .filter((file) => file.endsWith('agent.json'))
    .flatMap((file) => {
      const profile = JSON.parse(read(file));
      return (profile.allowedTools ?? []).map((tool) => ({
        agent: profile.id,
        path: relativePath(file),
        tool
      }));
    });
}

function countToolReferences(tool) {
  const files = ['apps', 'packages', 'tools']
    .flatMap((dir) => walk(join(root, dir)))
    .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'));
  const aliases = {
    'minimax.text': ['generateMiniMaxText'],
    'minimax.image': ['image_generation', 'creative.image'],
    'minimax.music': ['music_generation', 'creative.music'],
    'tavily.mcp.search': ['tavily-search'],
    'tavily.mcp.extract': ['tavily-extract']
  }[tool] ?? [tool];
  const needles = aliases.map((alias) => alias.toLowerCase());
  return files.reduce((count, file) => {
    const haystack = read(file).toLowerCase();
    return count + (needles.some((needle) => haystack.includes(needle)) ? 1 : 0);
  }, 0);
}

function parseTaskEvents() {
  const text = read(join(root, 'packages/core/src/shared/types.ts'));
  return [...text.matchAll(/\|\s+'(task\.[^']+|tool\.[^']+|approval\.[^']+)'/g)].map((match) => match[1]);
}

function countEventEmits(eventName) {
  const files = ['apps', 'packages']
    .flatMap((dir) => walk(join(root, dir)))
    .filter((file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx') && !file.endsWith('shared/types.ts'));
  const escapedEvent = eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const emitPatterns = [
    new RegExp(`createTaskEvent\\([^\\n]*['"]${escapedEvent}['"]`),
    new RegExp(`type:\\s*['"]${escapedEvent}['"]`)
  ];
  return files.reduce((count, file) => {
    const text = read(file);
    return count + (emitPatterns.some((pattern) => pattern.test(text)) ? 1 : 0);
  }, 0);
}

function printSignals(signals) {
  console.log('# Bubbles Fixture And Static Workflow Audit');
  console.log('');
  console.log('Default scope excludes tests, docs, and skills. Add --include-tests, --include-docs, or --include-skills for a wider audit.');
  console.log('Signals are intentionally broad. Review each item before treating it as product debt.');
  console.log('');

  for (const category of signalGroups.map((group) => group.name)) {
    const matches = signals.filter((signal) => signal.category === category);
    console.log(`## ${category}`);

    if (!matches.length) {
      console.log('- none found');
      console.log('');
      continue;
    }

    for (const signal of matches) {
      console.log(`- ${signal.path}:${signal.line} - ${signal.text}`);
    }

    console.log('');
  }
}

function printDeclaredTools() {
  console.log('## declared agent tools with weak executor evidence');
  const tools = parseAgentTools();

  for (const entry of tools) {
    const references = countToolReferences(entry.tool);
    if (references <= 1) {
      console.log(`- ${entry.path} declares \`${entry.tool}\` for \`${entry.agent}\`, but production code has ${references} direct reference(s).`);
    }
  }
  console.log('');
}

function printTaskEvents() {
  console.log('## task event types with no production emitter');
  const events = parseTaskEvents();

  for (const event of events) {
    const references = countEventEmits(event);
    if (references === 0) {
      console.log(`- \`${event}\``);
    }
  }
  console.log('');
}

printSignals(collectSignals());
printDeclaredTools();
printTaskEvents();
