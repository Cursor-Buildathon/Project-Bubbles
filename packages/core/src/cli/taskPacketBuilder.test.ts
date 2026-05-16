import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { buildTaskPacket } from './taskPacketBuilder.js';

describe('buildTaskPacket', () => {
  it('builds a complete task packet from the active general assistant files', async () => {
    const rootDir = join(tmpdir(), `bubbles-agent-${Date.now()}`);
    const agentDir = join(rootDir, 'agents', 'general-assistant');
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, 'agent.json'),
      JSON.stringify({
        id: 'general-assistant',
        name: 'Bubbles',
        role: 'General assistant',
        badgeName: 'Bubbles',
        voiceStyle: 'warm and concise',
        allowedTools: ['minimax.text'],
        memoryRules: ['Remember explicit user preferences only.'],
        safetyRules: ['Ask before sensitive actions.'],
        responseStyle: 'Clear spoken summary',
        skillsPath: 'agents/general-assistant/skills.md',
        createdAt: '2026-05-14T00:00:00.000Z',
        updatedAt: '2026-05-14T00:00:00.000Z'
      }),
      'utf8'
    );
    await writeFile(join(agentDir, 'skills.md'), '# General skills\n\nAnswer clearly.', 'utf8');

    const packet = await buildTaskPacket({
      activeAgentId: 'general-assistant',
      memoryContext: [
        {
          id: 'mem-1',
          type: 'user_preference',
          content: 'Prefers short answers.',
          tags: ['style'],
          importance: 3,
          createdAt: '2026-05-14T00:00:00.000Z',
          updatedAt: '2026-05-14T00:00:00.000Z'
        }
      ],
      projectRoot: rootDir,
      userText: 'Summarize my project'
    });

    expect(packet).toMatchObject({
      userText: 'Summarize my project',
      activeAgentId: 'general-assistant',
      taskType: 'general.plan',
      mode: 'plan_then_act',
      skillsMarkdown: '# General skills\n\nAnswer clearly.',
      allowedTools: ['minimax.text'],
      approvalPolicy: 'preview_sensitive_actions',
      outputPreference: {
        userLevel: 'nontechnical',
        responseStyle: 'clear_spoken_summary',
        includeTechnicalDetails: false
      }
    });
    expect(packet.taskId).toMatch(/^task-/);
    expect(packet.memoryContext).toHaveLength(1);
  });

  it('accepts explicit task routing, connector context, and approval policy overrides', async () => {
    const rootDir = join(tmpdir(), `bubbles-agent-routing-${Date.now()}`);
    const agentDir = join(rootDir, 'agents', 'research-agent');
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, 'agent.json'),
      JSON.stringify({
        id: 'research-agent',
        name: 'Research Bubbles',
        role: 'Research assistant',
        badgeName: 'Research',
        voiceStyle: 'clear and sourced',
        allowedTools: ['web.search'],
        memoryRules: ['Save useful research findings.'],
        safetyRules: ['Name uncertainty.'],
        responseStyle: 'Source-aware summary',
        skillsPath: 'agents/research-agent/skills.md',
        createdAt: '2026-05-14T00:00:00.000Z',
        updatedAt: '2026-05-14T00:00:00.000Z'
      }),
      'utf8'
    );
    await writeFile(join(agentDir, 'skills.md'), '# Research skills\n\nCite sources.', 'utf8');

    const packet = await buildTaskPacket({
      activeAgentId: 'research-agent',
      approvalPolicy: 'preview_all_actions',
      connectorContext: {
        web: {
          results: [{ title: 'MCP docs', url: 'https://example.com/mcp', snippet: 'Tool servers connect apps.' }]
        }
      },
      projectRoot: rootDir,
      taskType: 'research.web',
      userText: 'Research MCP tools'
    });

    expect(packet).toMatchObject({
      activeAgentId: 'research-agent',
      taskType: 'research.web',
      approvalPolicy: 'preview_all_actions',
      connectorContext: {
        web: {
          results: [{ title: 'MCP docs', url: 'https://example.com/mcp', snippet: 'Tool servers connect apps.' }]
        }
      }
    });
  });
});
