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

  it('speaks replies under the 500 character limit in full', () => {
    const underLimitSummary = '1234567890'.repeat(40);

    expect(
      prepareSpokenResponse({
        chatText: underLimitSummary,
        summary: underLimitSummary
      })
    ).toEqual({
      voiceText: underLimitSummary,
      captionText: underLimitSummary,
      summarized: false
    });
  });

  it('asks the user to look in chat for replies with exactly 500 characters', () => {
    const exactLimitSummary = '1234567890'.repeat(50);

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

  it('asks the user to look in chat for replies over 500 characters', () => {
    const longSummary = [
      'I finished that task and added the full details in the chat panel.',
      'The important part is complete, and I included the verification notes so you can see what changed.',
      'I also kept the implementation small so the existing voice playback path still receives the same kind of prepared response.',
      'This final sentence keeps the fixture comfortably above the new spoken response character limit.',
      'One more sentence makes the intended boundary obvious without changing the behavior being tested.',
      'This closing line keeps the sample above five hundred characters.'
    ].join(' ');

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
