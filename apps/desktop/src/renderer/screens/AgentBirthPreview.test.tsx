import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentBirthPreview } from './AgentBirthPreview';
import { type AgentBirthDraft } from '@bubbles/core';

describe('AgentBirthPreview', () => {
  it('previews a generated agent and requires confirmation before creation', async () => {
    const draft: AgentBirthDraft = {
      profile: {
        id: 'research-helper',
        name: 'Research Helper',
        role: 'Research assistant',
        badgeName: 'Research',
        voiceStyle: 'Curious',
        allowedTools: ['minimax.text'],
        memoryRules: [],
        safetyRules: [],
        responseStyle: 'Structured',
        skillsPath: 'agents/research-helper/skills.md',
        createdAt: '2026-05-14T00:00:00.000Z',
        updatedAt: '2026-05-14T00:00:00.000Z'
      },
      skillsMarkdown: '# Research Helper'
    };
    const onPreview = vi.fn().mockResolvedValue(draft);
    const onCreate = vi.fn().mockResolvedValue(draft.profile);

    render(<AgentBirthPreview onCreate={onCreate} onPreview={onPreview} />);

    fireEvent.change(screen.getByLabelText('Agent request'), { target: { value: 'Create a research helper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview agent' }));

    expect(await screen.findByText('Research Helper')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Create approved agent' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(draft));
  });
});
