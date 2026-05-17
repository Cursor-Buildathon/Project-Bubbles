import { redactSecrets } from '../security/redactSecrets.js';
import { type VoiceProvider } from './voiceTypes.js';

const geminiAudioEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const openAiTranslationEndpoint = 'https://api.openai.com/v1/audio/translations';
const defaultTimeoutMs = 15_000;

interface ResponseLike {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

export interface TranscribeAudioInput {
  audioDataUrl: string;
  mimeType: string;
}

export type TranscriptionFailureReason = 'auth' | 'network' | 'not_configured' | 'provider' | 'quota' | 'rate_limit';

export type TranscribeAudioResult =
  | { ok: true; provider: Extract<VoiceProvider, 'gemini' | 'openai'>; transcript: string }
  | {
      ok: false;
      error: string;
      provider?: Extract<VoiceProvider, 'gemini' | 'openai'>;
      reason: TranscriptionFailureReason;
      retryable: boolean;
    };

interface VoiceTranscriptionServiceOptions {
  fetch?: FetchLike;
  geminiApiKey?: string;
  openAiApiKey?: string;
  timeoutMs?: number;
}

type ProviderFailure = Extract<TranscribeAudioResult, { ok: false }> & { provider: Extract<VoiceProvider, 'gemini' | 'openai'> };

export function createVoiceTranscriptionService({
  fetch: fetchImpl = globalThis.fetch as FetchLike,
  geminiApiKey,
  openAiApiKey,
  timeoutMs = defaultTimeoutMs
}: VoiceTranscriptionServiceOptions = {}) {
  return {
    async transcribe(input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
      const failures: ProviderFailure[] = [];

      if (geminiApiKey) {
        const result = await safeTranscribe('gemini', () => transcribeWithGemini({ apiKey: geminiApiKey, fetchImpl, input, timeoutMs }));

        if (result.ok) {
          return result;
        }

        failures.push(result);
      }

      if (openAiApiKey) {
        const result = await safeTranscribe('openai', () => transcribeWithOpenAi({ apiKey: openAiApiKey, fetchImpl, input, timeoutMs }));

        if (result.ok) {
          return result;
        }

        failures.push(result);
      }

      if (!geminiApiKey && !openAiApiKey) {
        return {
          ok: false,
          error: 'Voice STT needs a Gemini or OpenAI key in setup.',
          reason: 'not_configured',
          retryable: false
        };
      }

      return summarizeFailures(failures, { openAiConfigured: Boolean(openAiApiKey) });
    }
  };
}

async function safeTranscribe(
  provider: Extract<VoiceProvider, 'gemini' | 'openai'>,
  run: () => Promise<string>
): Promise<Extract<TranscribeAudioResult, { ok: true }> | ProviderFailure> {
  try {
    const transcript = (await run()).trim();

    if (!transcript) {
      return {
        ok: false,
        provider,
        error: `${providerLabel(provider)} returned an empty transcript.`,
        reason: 'provider',
        retryable: true
      };
    }

    return { ok: true, provider, transcript };
  } catch (error) {
    return classifyFailure(provider, error);
  }
}

async function transcribeWithGemini({
  apiKey,
  fetchImpl,
  input,
  timeoutMs
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  input: TranscribeAudioInput;
  timeoutMs: number;
}) {
  const audioBase64 = extractDataUrlBase64(input.audioDataUrl);
  const response = await fetchWithTimeout(
    fetchImpl,
    geminiAudioEndpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'Transcribe this audio into English only. If the speaker uses another language, translate the meaning into English. Return only the final English text with no labels.'
              },
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: audioBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0
        }
      })
    },
    timeoutMs
  );

  if (!response.ok) {
    const body = response.text ? await response.text() : '';
    throw new TranscriptionProviderError('gemini', response.status, body);
  }

  return extractGeminiText(await response.json());
}


async function transcribeWithOpenAi({
  apiKey,
  fetchImpl,
  input,
  timeoutMs
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  input: TranscribeAudioInput;
  timeoutMs: number;
}) {
  const { buffer, mimeType } = decodeDataUrl(input.audioDataUrl, input.mimeType);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), `bubbles-voice.${extensionForMimeType(mimeType)}`);
  form.append('model', 'whisper-1');
  form.append('prompt', 'Return English text only.');

  const response = await fetchWithTimeout(
    fetchImpl,
    openAiTranslationEndpoint,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    },
    timeoutMs
  );

  if (!response.ok) {
    const body = response.text ? await response.text() : '';
    throw new TranscriptionProviderError('openai', response.status, body);
  }

  const body = await response.json();
  const text = (body as { text?: unknown }).text;

  return typeof text === 'string' ? text : '';
}

async function fetchWithTimeout(fetchImpl: FetchLike, input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractGeminiText(body: unknown) {
  const candidates = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates ?? [];
  return candidates
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

function extractDataUrlBase64(dataUrl: string) {
  const [, base64] = dataUrl.split(',', 2);
  return base64 ?? dataUrl;
}

function decodeDataUrl(dataUrl: string, fallbackMimeType: string) {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(dataUrl);
  const mimeType = match?.[1] || fallbackMimeType || 'audio/wav';
  const base64 = match?.[2] ?? dataUrl;

  return {
    buffer: Buffer.from(base64, 'base64'),
    mimeType
  };
}

function extensionForMimeType(mimeType: string) {
  const normalized = mimeType.split(';', 1)[0]?.trim().toLowerCase();

  if (normalized === 'audio/webm') {
    return 'webm';
  }

  if (normalized === 'audio/mp4' || normalized === 'audio/m4a' || normalized === 'audio/x-m4a') {
    return 'm4a';
  }

  if (normalized === 'audio/mpeg' || normalized === 'audio/mp3') {
    return 'mp3';
  }

  if (normalized === 'audio/ogg' || normalized === 'audio/opus') {
    return 'ogg';
  }

  return 'wav';
}

function providerLabel(provider: Extract<VoiceProvider, 'gemini' | 'openai'>) {
  return provider === 'gemini' ? 'Gemini' : 'OpenAI';
}

class TranscriptionProviderError extends Error {
  constructor(
    readonly provider: Extract<VoiceProvider, 'gemini' | 'openai'>,
    readonly status: number,
    readonly body: string
  ) {
    super(`${providerLabel(provider)} transcription failed (${status}): ${body}`);
  }
}

function classifyFailure(provider: Extract<VoiceProvider, 'gemini' | 'openai'>, error: unknown): ProviderFailure {
  if (error instanceof TranscriptionProviderError) {
    const reason = classifyStatus(error.status, error.body);

    return {
      ok: false,
      provider,
      reason,
      retryable: isRetryable(reason),
      error: redactSecrets(`${providerLabel(provider)} transcription failed (${error.status}): ${error.body}`)
    };
  }

  const text = redactSecrets(error);
  const reason = /network|fetch|connection|timeout|aborted|abort/i.test(text) ? 'network' : 'provider';

  return {
    ok: false,
    provider,
    reason,
    retryable: isRetryable(reason),
    error: text
  };
}

function classifyStatus(status: number, body: string): TranscriptionFailureReason {
  if (status === 401 || status === 403 || /auth|api key|permission|unauthorized|forbidden/i.test(body)) {
    return 'auth';
  }

  if (status === 429 && /quota|resource_exhausted|free_tier|daily|perday|billing/i.test(body)) {
    return 'quota';
  }

  if (status === 429 || /rate.?limit|retry/i.test(body)) {
    return 'rate_limit';
  }

  if (status >= 500) {
    return 'provider';
  }

  return 'provider';
}

function isRetryable(reason: TranscriptionFailureReason) {
  return reason === 'network' || reason === 'provider' || reason === 'rate_limit';
}

function summarizeFailures(
  failures: ProviderFailure[],
  { openAiConfigured }: { openAiConfigured: boolean }
): Extract<TranscribeAudioResult, { ok: false }> {
  const geminiFailure = failures.find((failure) => failure.provider === 'gemini');
  const openAiFailure = failures.find((failure) => failure.provider === 'openai');
  const geminiQuotaExhausted = geminiFailure?.reason === 'quota' || geminiFailure?.reason === 'rate_limit';

  if (geminiQuotaExhausted && !openAiConfigured) {
    return {
      ok: false,
      provider: 'gemini',
      reason: geminiFailure.reason,
      retryable: false,
      error: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.'
    };
  }

  if (geminiQuotaExhausted && openAiFailure) {
    return {
      ok: false,
      provider: 'openai',
      reason: openAiFailure.reason,
      retryable: false,
      error: 'Voice STT is unavailable. Gemini quota is exhausted and OpenAI fallback failed.'
    };
  }

  const lastFailure = failures.at(-1);

  if (lastFailure) {
    return {
      ok: false,
      provider: lastFailure.provider,
      reason: lastFailure.reason,
      retryable: failures.some((failure) => failure.retryable),
      error: redactSecrets(failures.map((failure) => failure.error).join(' Then ') || 'Voice transcription failed.')
    };
  }

  return {
    ok: false,
    reason: 'provider',
    retryable: true,
    error: 'Voice transcription failed.'
  };
}
