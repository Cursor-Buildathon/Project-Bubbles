import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createAgentRegistry } from './agentRegistry.js';
import { type AgentProfile } from '../shared/types.js';

describe('createAgentRegistry', () => {
  it('loads agents, activates one, creates a new agent, and archives it', async () => {
    const projectRoot = join(tmpdir(), `bubbles-agent-registry-${Date.now()}`);
    const agentsRoot = join(projectRoot, 'agents');
    await writeAgent(projectRoot, {
      id: 'general-assistant',
      name: 'Bubbles',
      role: 'General assistant',
      badgeName: 'Bubbles',
      voiceStyle: 'Warm',
      allowedTools: ['minimax.text'],
      memoryRules: ['Use explicit memories.'],
      safetyRules: ['Ask before sensitive actions.'],
      responseStyle: 'Clear spoken summary',
      skillsPath: 'agents/general-assistant/skills.md',
      createdAt: '2026-05-14T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z'
    });

    const registry = createAgentRegistry({
      agentsRoot,
      now: () => '2026-05-14T01:00:00.000Z'
    });

    await registry.initialize();
    expect((await registry.list()).map((agent) => agent.id)).toEqual(['general-assistant']);

    await registry.create({
      profile: {
        id: 'demo-agent',
        name: 'Demo Bubbles',
        role: 'Coding assistant',
        badgeName: 'Code',
        voiceStyle: 'Precise',
        allowedTools: ['minimax.text', 'files.read'],
        memoryRules: ['Use project context.'],
        safetyRules: ['Ask before file writes.'],
        responseStyle: 'Concise technical summary',
        skillsPath: 'agents/demo-agent/skills.md',
        createdAt: '2026-05-14T01:00:00.000Z',
        updatedAt: '2026-05-14T01:00:00.000Z'
      },
      agentMarkdown: '# Coding Bubbles\n\nAI recommended coding profile.',
      skillsMarkdown: '# Coding skills\n\nHelp with project code.'
    }, { activate: false });

    expect((await registry.getActive()).id).toBe('general-assistant');
    expect((await registry.activate('demo-agent')).id).toBe('demo-agent');
    expect((await registry.getActive()).badgeName).toBe('Code');
    expect(await readFile(join(agentsRoot, 'demo-agent', 'agent.md'), 'utf8')).toContain('AI recommended coding profile');
    expect(await readFile(join(agentsRoot, 'demo-agent', 'skills.md'), 'utf8')).toContain('project code');

    await registry.archive('demo-agent');
    expect((await registry.list()).map((agent) => agent.id)).toEqual(['general-assistant']);
    expect(JSON.parse(await readFile(join(agentsRoot, 'demo-agent', 'agent.json'), 'utf8')).archivedAt).toBe(
      '2026-05-14T01:00:00.000Z'
    );
  });
});

async function writeAgent(projectRoot: string, profile: AgentProfile) {
  const agentDir = join(projectRoot, profile.skillsPath, '..');
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, 'agent.json'), `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  await writeFile(join(agentDir, 'skills.md'), '# General skills\n\nAnswer clearly.', 'utf8');
}
