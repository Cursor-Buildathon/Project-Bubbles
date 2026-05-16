import { redactSecrets } from '../security/redactSecrets.js';

const minimaxChatEndpoint = 'https://api.minimax.io/v1/chat/completions';

interface ResponseLike {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

export type VerificationResult = { ok: true } | { ok: false; error: string };

interface MiniMaxApiOptions {
  fetch?: FetchLike;
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
        model: 'MiniMax-M2.7-highspeed',
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
        error: redactSecrets(`MiniMax API verification failed (${response.status}): ${body}`)
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
  { fetch: fetchImpl = globalThis.fetch as FetchLike }: MiniMaxApiOptions = {}
): Promise<T> {
  const response = await fetchImpl(minimaxChatEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7-highspeed',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1200
    })
  });

  if (!response.ok) {
    const body = response.text ? await response.text() : '';
    throw new Error(redactSecrets(`MiniMax JSON generation failed (${response.status}): ${body}`));
  }

  const body = await response.json();
  const content = extractTextContent(body);

  if (!content) {
    throw new Error('MiniMax JSON generation returned no content.');
  }

  return parseJsonContent(content) as T;
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
