import { redactSecrets } from '../security/redactSecrets.js';
import { type CliEvent } from '../shared/types.js';

type CliEventType = CliEvent['type'];

const knownEventTypes = new Set<CliEventType>([
  'task.received',
  'task.status',
  'task.partial_output',
  'tool.requested',
  'approval.required',
  'approval.accepted',
  'approval.denied',
  'task.result',
  'task.error',
  'task.cancelled'
]);

export function createCliEventParser(taskId: string) {
  return {
    parseStdout(chunk: string) {
      return parseTextChunk(taskId, 'stdout', chunk);
    },

    parseStderr(chunk: string) {
      const text = redactSecrets(chunk).trim();

      if (!text) {
        return [];
      }

      const events = parseTextChunk(taskId, 'stderr', text);

      if (events.some((event) => event.type === 'task.error')) {
        return events;
      }

      return [
        createEvent(taskId, 'task.status', {
          level: 'error',
          text
        })
      ];
    },

    parseExit(exitCode: number | null) {
      const normalizedExitCode = exitCode ?? 1;

      if (normalizedExitCode === 0) {
        return createEvent(taskId, 'task.result', { exitCode: normalizedExitCode });
      }

      return createEvent(taskId, 'task.error', { exitCode: normalizedExitCode });
    }
  };
}

export function extractMiniMaxResponseText(rawOutput: string): string | undefined {
  const trimmedOutput = rawOutput.trim();

  if (!trimmedOutput || (!trimmedOutput.startsWith('{') && !trimmedOutput.startsWith('['))) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmedOutput) as unknown;
    const text = collectAssistantText(parsed).join('\n\n').trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

export function createEvent(taskId: string, type: CliEventType, payload: Record<string, unknown> = {}): CliEvent {
  return {
    taskId,
    type,
    payload,
    createdAt: new Date().toISOString()
  };
}

function parseTextChunk(taskId: string, stream: 'stdout' | 'stderr', chunk: string): CliEvent[] {
  const fullJsonEvent = parseJsonEvent(taskId, redactSecrets(chunk).trim());

  if (fullJsonEvent) {
    return [fullJsonEvent];
  }

  return splitLines(chunk).flatMap((line) => parseLine(taskId, stream, line));
}

function parseLine(taskId: string, stream: 'stdout' | 'stderr', rawLine: string): CliEvent[] {
  const text = redactSecrets(rawLine).trim();

  if (!text) {
    return [];
  }

  const jsonEvent = parseJsonEvent(taskId, text);

  if (jsonEvent) {
    return [jsonEvent];
  }

  if (/\b(need|needs|missing|required)\b.+\b(info|information|clarification|input)\b/i.test(text)) {
    return [
      createEvent(taskId, 'task.status', {
        status: 'missing_info',
        text
      })
    ];
  }

  return [
    createEvent(taskId, 'task.partial_output', {
      stream,
      text
    })
  ];
}

function parseJsonEvent(taskId: string, text: string): CliEvent | undefined {
  if (!text.startsWith('{')) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: { code?: number; message?: string; hint?: string };
      taskId?: string;
      type?: string;
      payload?: Record<string, unknown>;
    };

    if (parsed.error) {
      return createEvent(taskId, 'task.error', normalizeMiniMaxError(parsed.error));
    }

    if (!parsed.type || !knownEventTypes.has(parsed.type as CliEventType)) {
      return undefined;
    }

    return createEvent(parsed.taskId ?? taskId, parsed.type as CliEventType, parsed.payload ?? {});
  } catch {
    return undefined;
  }
}

export function normalizeMiniMaxError(error: { code?: number; message?: string; hint?: string }) {
  const rawMessage = error.message ?? 'MiniMax CLI request failed.';
  const category = categorizeMiniMaxError(error);

  return {
    category,
    errorCode: error.code,
    errorMessage: friendlyMiniMaxErrorMessage(category, rawMessage),
    hint: error.hint,
    rawMessage
  };
}

function categorizeMiniMaxError(error: { code?: number; message?: string; hint?: string }) {
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.hint ?? ''}`;

  if (/network|connection|proxy|timeout|ECONN|ENOTFOUND|ETIMEDOUT/i.test(text)) {
    return 'network';
  }

  if (/auth|unauthori[sz]ed|api key|token|401|403/i.test(text)) {
    return 'auth';
  }

  if (/quota|limit|429/i.test(text)) {
    return 'quota';
  }

  return 'unknown';
}

function friendlyMiniMaxErrorMessage(category: string, rawMessage: string) {
  if (category === 'network') {
    return 'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.';
  }

  if (category === 'auth') {
    return 'MiniMax CLI authentication failed. Recheck the Token Plan key in Settings.';
  }

  if (category === 'quota') {
    return 'MiniMax CLI quota check failed. Review your Token Plan quota, then use Recheck CLI.';
  }

  return rawMessage;
}

function splitLines(chunk: string) {
  const lines = chunk.split(/\r?\n/).map((line) => line.trim());
  return lines.filter(Boolean);
}

function collectAssistantText(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectAssistantText);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;

  if (record.type === 'thinking' || 'thinking' in record) {
    return [];
  }

  if (typeof record.text === 'string') {
    return [record.text];
  }

  if (typeof record.output_text === 'string') {
    return [record.output_text];
  }

  if (typeof record.message === 'string') {
    return [record.message];
  }

  if ('content' in record) {
    return collectAssistantText(record.content);
  }

  return [];
}
