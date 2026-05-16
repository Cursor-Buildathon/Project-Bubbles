import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentSwitcher } from './AgentSwitcher';
import { type AgentProfile } from '@bubbles/core';

describe('AgentSwitcher', () => {
  it('renders agents and activates the selected agent', () => {
    const onActivate = vi.fn();

    render(
      <AgentSwitcher
        activeAgentId="general-assistant"
        agents={[
          createAgent({ id: 'general-assistant', name: 'Bubbles', badgeName: 'Bubbles' }),
          createAgent({ id: 'demo-agent', name: 'Demo Bubbles', badgeName: 'Demo' })
        ]}
        onActivate={onActivate}
      />
    );

    expect(screen.getByRole('button', { name: 'Activate Demo Bubbles' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activate Demo Bubbles' }));
    expect(onActivate).toHaveBeenCalledWith('demo-agent');
  });
});

function createAgent(overrides: Partial<AgentProfile>): AgentProfile {
  return {
    id: 'general-assistant',
    name: 'Bubbles',
    role: 'General assistant',
    badgeName: 'Bubbles',
    voiceStyle: 'Warm',
    allowedTools: ['minimax.text'],
    memoryRules: [],
    safetyRules: [],
    responseStyle: 'Clear',
    skillsPath: 'agents/general-assistant/skills.md',
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
    ...overrides
  };
}
