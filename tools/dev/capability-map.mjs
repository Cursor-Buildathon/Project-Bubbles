#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function readJson(path) {
  return JSON.parse(read(path));
}

function unique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function matchAll(text, pattern, group = 1) {
  return [...text.matchAll(pattern)].map((match) => match[group]).filter(Boolean);
}

function walk(dir, files = []) {
  if (!existsSync(dir)) {
    return files;
  }

  for (const entry of readdirSync(dir)) {
    if (['.git', 'node_modules', 'out', 'dist', 'coverage', '.DS_Store'].includes(entry)) {
      continue;
    }

    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      walk(path, files);
    } else {
      files.push(path);
    }
  }

  return files;
}

const mainText = read(join(root, 'apps/desktop/src/main/main.ts'));
const preloadText = read(join(root, 'apps/desktop/src/main/preload.ts'));
const sharedTypes = read(join(root, 'packages/core/src/shared/types.ts'));
const voiceTypes = read(join(root, 'packages/core/src/voice/voiceTypes.ts'));
const connectorRegistry = read(join(root, 'packages/core/src/connectors/connectorRegistry.ts'));
const packageJson = readJson(join(root, 'package.json'));
const sourceFiles = ['apps', 'packages'].flatMap((dir) => walk(join(root, dir)));
const sourceText = sourceFiles.map(read).join('\n');

const ipcHandlers = unique([
  ...matchAll(mainText, /ipcMain\.handle\('([^']+)'/g),
  ...walk(join(root, 'apps/desktop/src/main/ipc')).flatMap((file) => matchAll(read(file), /ipcMain\.handle\('([^']+)'/g))
]);
const preloadInvokes = unique(matchAll(preloadText, /ipcRenderer\.invoke\('([^']+)'/g));
const envFlags = unique([...matchAll(sourceText, /process\.env\.([A-Z0-9_]+)/g), ...matchAll(sourceText, /\b(BUBBLES_[A-Z0-9_]+)\b/g)]);
const taskTypeBlock = /export type TaskType =([\s\S]*?);/.exec(sharedTypes)?.[1] ?? '';
const taskTypes = unique(matchAll(taskTypeBlock, /\|\s+'([^']+)'/g));
const taskEvents = unique(matchAll(sharedTypes, /\|\s+'(task\.[^']+|tool\.[^']+|approval\.[^']+)'/g));
const voiceTypesExported = unique(matchAll(voiceTypes, /export (?:interface|type) ([A-Za-z0-9_]+)/g));
const connectorIds = unique(matchAll(connectorRegistry, /createDefault\('([^']+)'/g));

const agents = walk(join(root, 'agents'))
  .filter((file) => file.endsWith('agent.json'))
  .map((file) => {
    const profile = readJson(file);
    return {
      id: profile.id,
      role: profile.role,
      tools: profile.allowedTools ?? []
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

function section(title, lines) {
  console.log(`\n## ${title}`);
  if (!lines.length) {
    console.log('- none found');
    return;
  }
  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

console.log('# Bubbles Capability Map');
console.log(`Generated from ${relative(root, root) || '.'}`);

section(
  'Root Scripts',
  Object.entries(packageJson.scripts ?? {}).map(([name, command]) => `\`${name}\`: \`${command}\``)
);
section('Environment Flags', envFlags.map((flag) => `\`${flag}\``));
section('IPC Handlers', ipcHandlers.map((channel) => `\`${channel}\``));
section(
  'Preload Invokes',
  preloadInvokes.map((channel) => {
    const wired = ipcHandlers.includes(channel) ? 'wired' : 'missing handler';
    return `\`${channel}\` (${wired})`;
  })
);
section('Task Types', taskTypes.map((type) => `\`${type}\``));
section('Task Events', taskEvents.map((event) => `\`${event}\``));
section('Connectors', connectorIds.map((id) => `\`${id}\``));
section('Voice Types', voiceTypesExported.map((name) => `\`${name}\``));
section(
  'Agents',
  agents.map((agent) => `\`${agent.id}\` - ${agent.role}; tools: ${agent.tools.map((tool) => `\`${tool}\``).join(', ') || 'none'}`)
);
