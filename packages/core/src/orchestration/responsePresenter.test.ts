import { describe, expect, it } from 'vitest';
import { presentResponse } from './responsePresenter.js';

const chatPanelPrompt = 'Please look in the chat panel for the response.';

describe('presentResponse', () => {
  it('presents research results with sources and uncertainty', () => {
    expect(
      presentResponse({
        taskType: 'research.web',
        status: 'completed',
        summary: 'MCP tools connect apps through explicit tool servers.',
        sources: [{ title: 'MCP Docs', url: 'https://example.com/mcp' }],
        uncertainty: 'Provider configuration was fixture-backed.'
      })
    ).toEqual({
      text: 'MCP tools connect apps through explicit tool servers.\n\nSources:\n- MCP Docs: https://example.com/mcp\n\nUncertainty: Provider configuration was fixture-backed.',
      voiceText: chatPanelPrompt,
      captionText: chatPanelPrompt,
      voiceSummarized: true,
      status: 'completed'
    });
  });

  it('presents blocked connector states without leaking technical payloads', () => {
    expect(
      presentResponse({
        taskType: 'research.web',
        status: 'blocked',
        summary: 'Tavily Research is not connected.',
        nextStep: 'Add a Tavily API key in Connectors.'
      })
    ).toMatchObject({
      text: 'Tavily Research is not connected.\n\nNext step: Add a Tavily API key in Connectors.',
      voiceText: 'Tavily Research is not connected.',
      captionText: 'Tavily Research is not connected.',
      voiceSummarized: false,
      status: 'blocked'
    });
  });

  it('points long responses to the chat panel while keeping the full chat text', () => {
    const summary = [
      'First, sort your tasks by deadline and energy.',
      'Then block focus time for the hardest work.',
      'After that, batch messages into two windows so they do not fracture the day.',
      'Finally, keep a small buffer for anything that arrives late.',
      'If another request interrupts the plan, move it into the buffer instead of rebuilding the schedule.',
      'This keeps the day flexible without losing the most important work.'
    ].join(' ');

    expect(
      presentResponse({
        taskType: 'general.plan',
        status: 'completed',
        summary,
        nextStep: 'Choose the first focus block.'
      })
    ).toEqual({
      text: `${summary}\n\nNext step: Choose the first focus block.`,
      voiceText: chatPanelPrompt,
      captionText: chatPanelPrompt,
      voiceSummarized: true,
      status: 'completed'
    });
  });

  it('preserves voice style metadata without changing the spoken response text', () => {
    expect(
      presentResponse({
        taskType: 'general.plan',
        status: 'completed',
        summary: 'I found the issue and can help you fix it.',
        affect: {
          primary: 'frustrated',
          confidence: 0.9,
          urgency: 2,
          evidence: ['this is broken'],
          ttsStyle: 'calm'
        }
      })
    ).toEqual({
      text: 'I found the issue and can help you fix it.',
      voiceText: 'I found the issue and can help you fix it.',
      captionText: 'I found the issue and can help you fix it.',
      voiceStyle: 'calm',
      voiceSummarized: false,
      status: 'completed'
    });
  });
});
