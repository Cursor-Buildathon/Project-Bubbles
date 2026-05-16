import { describe, expect, it } from 'vitest';
import { prepareSpokenResponse } from './spokenResponsePolicy.js';

describe('prepareSpokenResponse', () => {
  it('speaks short replies in full', () => {
    expect(
      prepareSpokenResponse({
        chatText: 'I can help you plan the day.',
        summary: 'I can help you plan the day.'
      })
    ).toEqual({
      voiceText: 'I can help you plan the day.',
      captionText: 'I can help you plan the day.',
      summarized: false
    });
  });

  it('summarizes long replies and points to chat for the full text', () => {
    const longSummary = [
      'First, sort your tasks by deadline and energy.',
      'Then block focus time for the hardest work.',
      'After that, batch messages into two windows so they do not fracture the day.',
      'Finally, keep a small buffer for anything that arrives late.',
      'If another request interrupts the plan, move it into the buffer instead of rebuilding the schedule.',
      'This keeps the day flexible without losing the most important work.'
    ].join(' ');

    expect(
      prepareSpokenResponse({
        chatText: `${longSummary}\n\nNext step: choose the first focus block.`,
        summary: longSummary
      })
    ).toEqual({
      voiceText:
        'Short version: First, sort your tasks by deadline and energy. Then block focus time for the hardest work. I put the full details in chat.',
      captionText:
        'Short version: First, sort your tasks by deadline and energy. Then block focus time for the hardest work. I put the full details in chat.',
      summarized: true
    });
  });
});
