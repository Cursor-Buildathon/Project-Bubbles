import { describe, expect, it, vi } from 'vitest';
import { generateMiniMaxJson, generateMiniMaxText, verifyMiniMaxApiKey } from './minimaxApiClient.js';

describe('verifyMiniMaxApiKey', () => {
  it('verifies a key with the MiniMax OpenAI-compatible chat endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }]
      })
    });

    await expect(verifyMiniMaxApiKey('sk-cp-valid', { fetch: fetchMock })).resolves.toEqual({
      ok: true
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-cp-valid',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
        model: 'MiniMax-M2.7',
          messages: [
            {
              role: 'user',
              content: 'Reply with exactly: ok'
            }
          ],
          max_completion_tokens: 8
        })
      })
    );
  });

  it('returns redacted API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid key sk-cp-invalid'
    });

    await expect(verifyMiniMaxApiKey('sk-cp-invalid', { fetch: fetchMock })).resolves.toEqual({
      ok: false,
      error: 'MiniMax API authentication failed. Recheck the Token Plan key in Settings.'
    });
  });

  it('handles network failures without exposing the key', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network blew up for sk-cp-network'));

    await expect(verifyMiniMaxApiKey('sk-cp-network', { fetch: fetchMock })).resolves.toEqual({
      ok: false,
      error: 'network blew up for [REDACTED]'
    });
  });
});

describe('generateMiniMaxJson', () => {
  it('generates typed JSON from a MiniMax chat response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"profile":{"id":"agent"},"skillsMarkdown":"# Skills"}'
            }
          }
        ]
      })
    });

    await expect(generateMiniMaxJson('sk-cp-valid', 'Create JSON', { fetch: fetchMock })).resolves.toEqual({
      profile: { id: 'agent' },
      skillsMarkdown: '# Skills'
    });
  });

  it('extracts JSON when MiniMax wraps it with reasoning text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '<think>Thinking through the agent request.</think>\n```json\n{"profile":{"id":"qa-agent"},"skillsMarkdown":"# QA Agent"}\n```'
            }
          }
        ]
      })
    });

    await expect(generateMiniMaxJson('sk-cp-valid', 'Create JSON', { fetch: fetchMock })).resolves.toEqual({
      profile: { id: 'qa-agent' },
      skillsMarkdown: '# QA Agent'
    });
  });

  it('prefers the generated JSON object over earlier reasoning arrays', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '<think>I considered ["id","name","role"] before answering.</think>\n{"profile":{"id":"qa-agent"},"skillsMarkdown":"# QA Agent"}'
            }
          }
        ]
      })
    });

    await expect(generateMiniMaxJson('sk-cp-valid', 'Create JSON', { fetch: fetchMock })).resolves.toEqual({
      profile: { id: 'qa-agent' },
      skillsMarkdown: '# QA Agent'
    });
  });
});

describe('generateMiniMaxText', () => {
  it('generates plain text with the Token Plan-supported MiniMax model and strips thinking blocks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: '<think>private chain of thought</think>\nHello from Bubbles.'
            }
          }
        ]
      })
    });

    await expect(generateMiniMaxText('sk-cp-token', 'Say hello', { fetch: fetchMock })).resolves.toBe('Hello from Bubbles.');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-cp-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'MiniMax-M2.7',
          messages: [{ role: 'user', content: 'Say hello' }],
          max_completion_tokens: 1200
        })
      })
    );
  });

  it('throws categorized redacted errors for direct MiniMax API failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid key sk-cp-secret'
    });

    await expect(generateMiniMaxText('sk-cp-secret', 'Say hello', { fetch: fetchMock })).rejects.toMatchObject({
      category: 'auth',
      message: 'MiniMax API authentication failed. Recheck the Token Plan key in Settings.'
    });
  });
});
