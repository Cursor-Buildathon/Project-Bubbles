import { redactSecrets } from '../security/redactSecrets.js';

const minimaxChatEndpoint = 'https://api.minimax.io/v1/chat/completions';
const defaultMiniMaxTextModel = 'MiniMax-M2.7';

interface ResponseLike {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

export type VerificationResult = { ok: true } | { ok: false; error: string };
export type MiniMaxErrorCategory = 'network' | 'auth' | 'quota' | 'unknown';

export class MiniMaxApiError extends Error {
  category: MiniMaxErrorCategory;
  status?: number;

  constructor(message: string, { category, status }: { category: MiniMaxErrorCategory; status?: number }) {
    super(message);
    this.name = 'MiniMaxApiError';
    this.category = category;
    this.status = status;
  }
}

interface MiniMaxApiOptions {
  fetch?: FetchLike;
  maxCompletionTokens?: number;
}

export async function verifyMiniMaxApiKey(
  apiKey: string,
  { fetch: fetchImpl = globalThis.fetch as FetchLike }: MiniMaxApiOptions = {}
): Promise<VerificationResult> {
  try {
    const response = await fetchImpl(minimaxChatEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: defaultMiniMaxTextModel,
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly: ok'
          }
        ],
        max_completion_tokens: 8
      })
    });

    if (!response.ok) {
      const body = response.text ? await response.text() : '';
      return {
        ok: false,
        error:
          friendlyMiniMaxApiErrorMessage(categorizeMiniMaxApiError(response.status, body)) ||
          redactSecrets(`MiniMax API verification failed (${response.status}): ${body}`)
      };
    }

    await response.json();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: redactSecrets(error)
    };
  }
}

export async function generateMiniMaxJson<T = unknown>(
  apiKey: string,
  prompt: string,
  { fetch: fetchImpl = globalThis.fetch as FetchLike, maxCompletionTokens = 1200 }: MiniMaxApiOptions = {}
): Promise<T> {
  let lastError: unknown;

  for (const useResponseFormat of [true, false]) {
    const response = await fetchImpl(minimaxChatEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: defaultMiniMaxTextModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        ...(useResponseFormat ? { response_format: { type: 'json_object' } } : {}),
        max_completion_tokens: maxCompletionTokens
      })
    });

    if (!response.ok) {
      const body = response.text ? await response.text() : '';
      throw createMiniMaxApiError(response.status, body, 'MiniMax JSON generation failed');
    }

    const body = await response.json();
    const content = stripThinkingBlocks(extractTextContent(body) ?? '');

    if (!content) {
      lastError = new Error('MiniMax JSON generation returned no content.');
      continue;
    }

    try {
      return parseJsonContent(content) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('MiniMax JSON generation returned no content.');
}

export async function generateMiniMaxText(
  apiKey: string,
  prompt: string,
  { fetch: fetchImpl = globalThis.fetch as FetchLike, maxCompletionTokens = 1200 }: MiniMaxApiOptions = {}
): Promise<string> {
  const response = await fetchImpl(minimaxChatEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: defaultMiniMaxTextModel,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: maxCompletionTokens
    })
  });

  if (!response.ok) {
    const body = response.text ? await response.text() : '';
    throw createMiniMaxApiError(response.status, body, 'MiniMax text generation failed');
  }

  const body = await response.json();
  const content = stripThinkingBlocks(extractTextContent(body) ?? '').trim();

  if (!content) {
    throw new Error('MiniMax text generation returned no content.');
  }

  return content;
}

export function createMiniMaxApiError(status: number | undefined, body: string, fallbackMessage: string) {
  const category = categorizeMiniMaxApiError(status, body);
  return new MiniMaxApiError(friendlyMiniMaxApiErrorMessage(category) || redactSecrets(`${fallbackMessage}${status ? ` (${status})` : ''}: ${body}`), {
    category,
    status
  });
}

export function categorizeMiniMaxApiError(status: number | undefined, body: string): MiniMaxErrorCategory {
  const text = `${status ?? ''} ${body}`;

  if (/network|connection|proxy|timeout|ECONN|ENOTFOUND|ETIMEDOUT/i.test(text)) {
    return 'network';
  }

  if (status === 401 || status === 403 || /auth|unauthori[sz]ed|api key|token|invalid key/i.test(text)) {
    return 'auth';
  }

  if (status === 429 || /quota|limit|rate/i.test(text)) {
    return 'quota';
  }

  return 'unknown';
}

export function friendlyMiniMaxApiErrorMessage(category: MiniMaxErrorCategory) {
  if (category === 'network') {
    return 'MiniMax API cannot reach the network right now. Check your connection or proxy settings, then recheck MiniMax.';
  }

  if (category === 'auth') {
    return 'MiniMax API authentication failed. Recheck the Token Plan key in Settings.';
  }

  if (category === 'quota') {
    return 'MiniMax API quota check failed. Review your Token Plan quota, then recheck MiniMax.';
  }

  return '';
}

function extractTextContent(body: unknown): string | undefined {
  const choice = (body as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> }).choices?.[0];
  const content = choice?.message?.content ?? choice?.text;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('');
  }

  return undefined;
}

function stripCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
}

function stripThinkingBlocks(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function parseJsonContent(text: string): unknown {
  const stripped = stripCodeFence(text);

  try {
    return JSON.parse(stripped);
  } catch (directError) {
    for (const candidate of findJsonCandidates(stripped, '{')) {
      try {
        return JSON.parse(candidate);
      } catch {
        // Keep scanning in case earlier braces came from explanatory text.
      }
    }

    for (const candidate of findJsonCandidates(stripped, '[')) {
      try {
        return JSON.parse(candidate);
      } catch {
        // Keep scanning in case earlier brackets came from explanatory text.
      }
    }

    throw directError;
  }
}

function* findJsonCandidates(text: string, opening: '{' | '['): Generator<string> {
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char !== opening) {
      continue;
    }

    const end = findBalancedJsonEnd(text, index);
    if (end !== undefined) {
      yield text.slice(index, end + 1);
    }
  }
}

function findBalancedJsonEnd(text: string, start: number): number | undefined {
  const opening = text[start];
  const closing = opening === '{' ? '}' : ']';
  const stack = [closing];
  let inString = false;
  let escaped = false;

  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      stack.push('}');
      continue;
    }

    if (char === '[') {
      stack.push(']');
      continue;
    }

    if (char === '}' || char === ']') {
      if (char !== stack.pop()) {
        return undefined;
      }

      if (stack.length === 0) {
        return index;
      }
    }
  }

  return undefined;
}
