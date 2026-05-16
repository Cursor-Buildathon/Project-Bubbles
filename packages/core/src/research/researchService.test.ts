import { describe, expect, it, vi } from 'vitest';
import { createResearchService, isReadResearchPrompt, isResearchFollowUp, isResearchPrompt, readyVoiceText } from './researchService.js';

describe('createResearchService', () => {
  it('creates a cited report and keeps voice output to a ready status', async () => {
    const generateText = vi.fn().mockResolvedValue('## Executive Summary\nBubbles found one source [1].');
    const service = createResearchService({ generateText, now: () => '2026-05-16T10:00:00.000Z' });

    await expect(
      service.createReport({
        query: 'research Bubbles',
        results: [{ title: 'Source', url: 'https://example.com', snippet: 'Snippet' }],
        extractedContent: ['Long source text']
      })
    ).resolves.toMatchObject({
      citations: [{ title: 'Source', url: 'https://example.com', snippet: 'Snippet' }],
      createdAt: '2026-05-16T10:00:00.000Z',
      query: 'research Bubbles',
      text: '## Executive Summary\nBubbles found one source [1].',
      voiceText: readyVoiceText()
    });
    expect(generateText.mock.calls[0][0]).toContain('## Key Findings');
  });

  it('answers follow-up questions from the previous report context', async () => {
    const generateText = vi.fn().mockResolvedValue('Follow-up answer [1].');
    const service = createResearchService({ generateText, now: () => '2026-05-16T10:00:00.000Z' });

    await expect(
      service.answerFollowUp({
        question: 'What matters most?',
        report: {
          citations: [{ title: 'Source', url: 'https://example.com', snippet: 'Snippet' }],
          createdAt: '2026-05-16T09:00:00.000Z',
          id: 'research-1',
          query: 'research topic',
          text: 'Existing report',
          voiceText: readyVoiceText()
        }
      })
    ).resolves.toMatchObject({
      id: 'research-1',
      text: 'Follow-up answer [1].',
      voiceText: readyVoiceText()
    });
    expect(generateText.mock.calls[0][0]).toContain('Previous research report');
  });
});

describe('research prompt helpers', () => {
  it('detects research starts, read-aloud requests, and follow-ups separately', () => {
    expect(isResearchPrompt('search me Tavily MCP')).toBe(true);
    expect(isResearchPrompt('do me a research on MiniMax')).toBe(true);
    expect(isReadResearchPrompt('read the research output')).toBe(true);
    expect(isResearchFollowUp('What are the tradeoffs?')).toBe(true);
  });
});
