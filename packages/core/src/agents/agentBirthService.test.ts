import { describe, expect, it } from 'vitest';
import { createAgentBirthService, createRecommendedAgentBirthDraft } from './agentBirthService.js';

describe('createAgentBirthService', () => {
  it('returns a safe agent draft from MiniMax JSON', async () => {
    const service = createAgentBirthService({
      generateJson: async () => ({
        profile: {
          id: 'research-helper',
          name: 'Research Helper',
          role: 'Research assistant',
          badgeName: 'Research',
          voiceStyle: 'Curious and crisp',
          allowedTools: ['minimax.text', 'minimax.search'],
          memoryRules: ['Remember recurring research preferences.'],
          safetyRules: ['Ask before sending external data.'],
          responseStyle: 'Structured research report',
          skillsPath: 'agents/research-helper/skills.md',
          createdAt: '2026-05-14T00:00:00.000Z',
          updatedAt: '2026-05-14T00:00:00.000Z'
        },
        agentMarkdown: '# Research Helper\n\nAI recommended profile.',
        skillsMarkdown: '# Research Helper\n\nFind and summarize sources.'
      }),
      now: () => '2026-05-14T02:00:00.000Z'
    });

    await expect(service.preview('Create a research helper')).resolves.toMatchObject({
      profile: {
        id: 'research-helper',
        skillsPath: 'agents/research-helper/skills.md'
      },
      agentMarkdown: expect.stringContaining('AI recommended profile'),
      skillsMarkdown: expect.stringContaining('Research Helper')
    });
  });

  it('rejects drafts that attempt to customize avatar visuals', async () => {
    const service = createAgentBirthService({
      generateJson: async () => ({
        profile: {
          id: 'visual-agent',
          name: 'Visual Agent',
          role: 'Unsafe assistant',
          badgeName: 'Visual',
          voiceStyle: 'Bright',
          allowedTools: ['minimax.text'],
          memoryRules: ['Remember visuals.'],
          safetyRules: ['Ask first.'],
          responseStyle: 'Short',
          skillsPath: 'agents/visual-agent/skills.md',
          createdAt: '2026-05-14T00:00:00.000Z',
          updatedAt: '2026-05-14T00:00:00.000Z',
          color: 'blue'
        },
        agentMarkdown: '# Visual Agent\n\nUse a blue costume.',
        skillsMarkdown: '# Visual Agent\n\nChange the sprite costume.'
      })
    });

    await expect(service.preview('Make Bubbles blue')).rejects.toThrow(/visual customization/i);
  });

  it('derives a safe id and skills path when the generated draft omits them', async () => {
    const service = createAgentBirthService({
      generateJson: async () => ({
        profile: {
          name: 'QA Test Agent',
          role: 'Manual QA assistant',
          badgeName: 'QA',
          voiceStyle: 'Careful and direct',
          allowedTools: 'minimax.text',
          memoryRules: 'Remember repeated QA findings.',
          safetyRules: 'Ask before changing files.',
          responseStyle: 'Checklist-driven QA notes'
        },
        agentMarkdown: '# QA Test Agent\n\nRecommended QA profile.',
        skillsMarkdown: '# QA Test Agent\n\nRun manual QA checklists.'
      }),
      now: () => '2026-05-14T02:00:00.000Z'
    });

    await expect(service.preview('Create a QA helper')).resolves.toMatchObject({
      profile: {
        id: 'qa-test-agent',
        skillsPath: 'agents/qa-test-agent/skills.md',
        allowedTools: ['minimax.text'],
        memoryRules: ['Remember repeated QA findings.'],
        safetyRules: ['Ask before changing files.']
      }
    });
  });

  it('fills safe defaults when the generated profile omits required strings', async () => {
    const service = createAgentBirthService({
      generateJson: async () => ({
        profile: {
          allowedTools: ['minimax.text'],
          memoryRules: ['Remember repeated QA findings.'],
          safetyRules: ['Ask before changing files.']
        },
        agentMarkdown: '',
        skillsMarkdown: ''
      }),
      now: () => '2026-05-14T02:00:00.000Z'
    });

    await expect(service.preview('Create a QA agent for manually testing this Bubbles MVP.')).resolves.toMatchObject({
      profile: {
        id: 'qa-agent',
        name: 'QA Agent',
        role: 'QA Agent assistant',
        badgeName: 'QA',
        voiceStyle: 'Clear and helpful',
        responseStyle: 'Concise, structured responses',
        skillsPath: 'agents/qa-agent/skills.md'
      },
      agentMarkdown: expect.stringContaining('# QA Agent'),
      skillsMarkdown: expect.stringContaining('# QA Agent')
    });
  });

  it('creates a safe recommended draft without MiniMax for demo fallback', () => {
    const draft = createRecommendedAgentBirthDraft('Create a QA agent', '2026-05-14T02:00:00.000Z');

    expect(draft).toMatchObject({
      profile: {
        id: 'qa-agent',
        name: 'QA Agent',
        skillsPath: 'agents/qa-agent/skills.md'
      },
      agentMarkdown: expect.stringContaining('## Recommended Profile'),
      skillsMarkdown: expect.stringContaining('## Response Pattern')
    });
  });

  it('preserves short custom agent descriptors in fallback drafts', () => {
    const draft = createRecommendedAgentBirthDraft('Create a AQ agent', '2026-05-14T02:00:00.000Z');

    expect(draft.profile).toMatchObject({
      id: 'aq-agent',
      name: 'AQ Agent',
      badgeName: 'AQ'
    });
  });
});
