import { redactSecrets } from '../security/redactSecrets.js';

export type TraceFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TraceFieldValue[]
  | { [key: string]: TraceFieldValue };

export interface TraceContext {
  traceId: string;
  voiceTurnId?: string | undefined;
  taskId?: string | undefined;
  approvalId?: string | undefined;
  ttsId?: string | undefined;
}

export interface TraceEvent extends TraceContext {
  name: string;
  timestamp: string;
  fields: Record<string, TraceFieldValue>;
}

export interface CreateTraceInput {
  traceId?: string | undefined;
  voiceTurnId?: string | undefined;
  taskId?: string | undefined;
  approvalId?: string | undefined;
  ttsId?: string | undefined;
}

export interface CreateTraceEventInput extends CreateTraceInput {
  name: string;
  fields?: Record<string, TraceFieldValue> | undefined;
}

export type TraceLogger = (event: TraceEvent) => void | Promise<void>;

export function createTrace(input: CreateTraceInput = {}): TraceContext {
  return {
    traceId: input.traceId ?? createId('trace'),
    voiceTurnId: input.voiceTurnId,
    taskId: input.taskId,
    approvalId: input.approvalId,
    ttsId: input.ttsId
  };
}

export function createTraceEvent(input: CreateTraceEventInput): TraceEvent {
  return {
    ...createTrace(input),
    name: input.name,
    timestamp: new Date().toISOString(),
    fields: sanitizeFields(input.fields ?? {})
  };
}

export async function logEvent(logger: TraceLogger, event: TraceEvent): Promise<void> {
  await logger(event);
}

export async function withTrace<T>(
  trace: TraceContext,
  name: string,
  operation: () => Promise<T>,
  logger?: TraceLogger
): Promise<T> {
  if (logger) {
    await logEvent(logger, createTraceEvent({ ...trace, name: `${name}.started` }));
  }

  try {
    const result = await operation();
    if (logger) {
      await logEvent(logger, createTraceEvent({ ...trace, name: `${name}.completed` }));
    }
    return result;
  } catch (error) {
    if (logger) {
      await logEvent(logger, createTraceEvent({ ...trace, name: `${name}.failed`, fields: { error: redactSecrets(error) } }));
    }
    throw error;
  }
}

function sanitizeFields(fields: Record<string, TraceFieldValue>): Record<string, TraceFieldValue> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, sanitizeField(value)]));
}

function sanitizeField(value: TraceFieldValue): TraceFieldValue {
  if (typeof value === 'string') {
    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeField);
  }

  if (value && typeof value === 'object') {
    return sanitizeFields(value);
  }

  return value;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
