import { describe, expect, it } from 'vitest';
import { validateAgentProfile } from './agentSchema.js';

const validProfile = {
  id: 'research-agent',
  name: 'Research Bubbles',
  role: 'Research assistant',
  badgeName: 'Research',
  voiceStyle: 'Curious and concise',
  allowedTools: ['minimax.text', 'minimax.search'],
  memoryRules: ['Use project context memories when relevant.'],
  safetyRules: ['Ask before external data sharing.'],
  responseStyle: 'Structured research summary',
  skillsPath: 'agents/research-agent/skills.md',
  createdAt: '2026-05-14T00:00:00.000Z',
  updatedAt: '2026-05-14T00:00:00.000Z'
};

describe('validateAgentProfile', () => {
  it('accepts a complete agent profile without visual customization fields', () => {
    expect(validateAgentProfile(validProfile)).toEqual(validProfile);
  });

  it('rejects visual customization fields so agents cannot alter the Bubbles body', () => {
    expect(() =>
      validateAgentProfile({
        ...validProfile,
        theme: 'purple',
        avatarStyle: 'wizard costume'
      })
    ).toThrow(/visual customization/i);
  });

  it('rejects malformed profile fields', () => {
    expect(() =>
      validateAgentProfile({
        ...validProfile,
        allowedTools: 'minimax.text'
      })
    ).toThrow(/allowedTools/i);
  });
});
