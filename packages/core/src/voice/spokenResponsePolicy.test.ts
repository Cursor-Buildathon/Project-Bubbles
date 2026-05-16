import { describe, expect, it } from 'vitest';
import { prepareSpokenResponse } from './spokenResponsePolicy.js';

const chatPanelPrompt = 'Please look in the chat panel for the response.';

describe('prepareSpokenResponse', () => {
  it('speaks short replies in full', () => {
    expect(
      prepareSpokenResponse({
        chatText: 'Done. I fixed it.',
        summary: 'Done. I fixed it.'
      })
    ).toEqual({
      voiceText: 'Done. I fixed it.',
      captionText: 'Done. I fixed it.',
      summarized: false
    });
  });

  it('asks the user to look in chat for replies with exactly 50 characters', () => {
    const exactLimitSummary = '1234567890'.repeat(5);

    expect(
      prepareSpokenResponse({
        chatText: exactLimitSummary,
        summary: exactLimitSummary
      })
    ).toEqual({
      voiceText: chatPanelPrompt,
      captionText: chatPanelPrompt,
      summarized: true
    });
  });

  it('asks the user to look in chat for replies over 50 characters', () => {
    const longSummary = 'I finished that task and added the full details in the chat panel.';

    expect(
      prepareSpokenResponse({
        chatText: longSummary,
        summary: longSummary
      })
    ).toEqual({
      voiceText: chatPanelPrompt,
      captionText: chatPanelPrompt,
      summarized: true
    });
  });
});
