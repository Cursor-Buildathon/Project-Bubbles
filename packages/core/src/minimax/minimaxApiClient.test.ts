import { describe, expect, it, vi } from 'vitest';
import { generateMiniMaxJson, verifyMiniMaxApiKey } from './minimaxApiClient.js';

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
          model: 'MiniMax-M2.7-highspeed',
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
      error: 'MiniMax API verification failed (401): invalid key [REDACTED]'
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
