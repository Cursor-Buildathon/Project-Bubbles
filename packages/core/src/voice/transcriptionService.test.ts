import { describe, expect, it, vi } from 'vitest';
import { createVoiceTranscriptionService } from './transcriptionService.js';

const wavDataUrl = `data:audio/wav;base64,${Buffer.from('wav-bytes').toString('base64')}`;

describe('createVoiceTranscriptionService', () => {
  it('transcribes audio through Gemini with the API key in a header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Plan the demo.' }] } }]
      })
    });
    const service = createVoiceTranscriptionService({ fetch: fetchMock, geminiApiKey: 'gemini-secret' });

    await expect(service.transcribe({ audioDataUrl: wavDataUrl, mimeType: 'audio/wav' })).resolves.toEqual({
      ok: true,
      provider: 'gemini',
      transcript: 'Plan the demo.'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': 'gemini-secret'
        },
        body: expect.stringContaining('English only')
      })
    );
  });

  it('falls back to OpenAI when Gemini fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'gemini down'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ text: 'Fallback transcript.' })
      });
    const service = createVoiceTranscriptionService({
      fetch: fetchMock,
      geminiApiKey: 'gemini-secret',
      openAiApiKey: 'openai-secret'
    });

    await expect(service.transcribe({ audioDataUrl: wavDataUrl, mimeType: 'audio/wav' })).resolves.toEqual({
      ok: true,
      provider: 'openai',
      transcript: 'Fallback transcript.'
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.openai.com/v1/audio/translations',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer openai-secret'
        },
        body: expect.any(FormData)
      })
    );
    const form = fetchMock.mock.calls[1][1].body as FormData;
    expect(form.get('prompt')).toBe('Return English text only.');
  });

  it('returns an actionable terminal error when no STT key is configured', async () => {
    const service = createVoiceTranscriptionService({ fetch: vi.fn() });

    await expect(service.transcribe({ audioDataUrl: wavDataUrl, mimeType: 'audio/wav' })).resolves.toEqual({
      ok: false,
      error: 'Voice STT needs a Gemini or OpenAI key in setup.',
      reason: 'not_configured',
      retryable: false
    });
  });

  it('fails over to OpenAI immediately when Gemini quota is exhausted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGeminiQuota429())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ text: 'OpenAI fallback.' })
      });
    const service = createVoiceTranscriptionService({
      fetch: fetchMock,
      geminiApiKey: 'gemini-secret',
      openAiApiKey: 'openai-secret'
    });

    await expect(service.transcribe({ audioDataUrl: wavDataUrl, mimeType: 'audio/wav' })).resolves.toEqual({
      ok: true,
      provider: 'openai',
      transcript: 'OpenAI fallback.'
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns a terminal quota error when Gemini quota is exhausted without OpenAI fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeGeminiQuota429());
    const service = createVoiceTranscriptionService({ fetch: fetchMock, geminiApiKey: 'gemini-secret' });

    await expect(service.transcribe({ audioDataUrl: wavDataUrl, mimeType: 'audio/wav' })).resolves.toEqual({
      ok: false,
      error: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.',
      provider: 'gemini',
      reason: 'quota',
      retryable: false
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a terminal sanitized error when Gemini quota and OpenAI fallback both fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeGeminiQuota429())
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'bad key sk-cp-openai'
      });
    const service = createVoiceTranscriptionService({
      fetch: fetchMock,
      geminiApiKey: 'gemini-secret',
      openAiApiKey: 'openai-secret'
    });

    const result = await service.transcribe({ audioDataUrl: wavDataUrl, mimeType: 'audio/wav' });

    expect(result).toMatchObject({
      ok: false,
      error: 'Voice STT is unavailable. Gemini quota is exhausted and OpenAI fallback failed.',
      provider: 'openai',
      reason: 'auth',
      retryable: false
    });
    expect(result).not.toMatchObject({
      error: expect.stringContaining('sk-cp-openai')
    });
  });

  it('redacts provider errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'bad key sk-cp-secret'
    });
    const service = createVoiceTranscriptionService({ fetch: fetchMock, geminiApiKey: 'gemini-secret' });

    await expect(service.transcribe({ audioDataUrl: wavDataUrl, mimeType: 'audio/wav' })).resolves.toMatchObject({
      ok: false,
      error: expect.not.stringContaining('sk-cp-secret')
    });
  });
});

function makeGeminiQuota429() {
  return {
    ok: false,
    status: 429,
    text: async () =>
      JSON.stringify({
        error: {
          code: 429,
          message:
            'You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '57s' }]
        }
      })
  };
}
