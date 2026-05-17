import { type MemoryItem } from '../shared/types.js';

type GenerateJson = (prompt: string) => Promise<unknown>;

interface MemoryExtractorOptions {
  generateJson: GenerateJson;
}

export interface ExtractMemoryOptions {
  activeAgentId: string;
  sourceTaskId?: string;
  userText: string;
}

export function createMemoryExtractor({ generateJson }: MemoryExtractorOptions) {
  return {
    async extract({ activeAgentId, sourceTaskId, userText }: ExtractMemoryOptions) {
      let response: unknown;

      try {
        response = await generateJson(createPrompt(userText));
      } catch {
        return [];
      }

      if (!Array.isArray(response)) {
        return [];
      }

      return response
        .map((item) => normalizeExtractedMemory(item, activeAgentId, sourceTaskId))
        .filter((item): item is Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> => Boolean(item));
    }
  };
}

export function parseExplicitRememberCommand(userText: string): string | undefined {
  const match = userText.trim().match(/^remember(?:\s+that)?\s+(.+)$/i);
  return match?.[1]?.trim();
}

function normalizeExtractedMemory(
  value: unknown,
  activeAgentId: string,
  sourceTaskId?: string
): Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const memory = value as Partial<MemoryItem>;

  if (typeof memory.content !== 'string' || !memory.content.trim()) {
    return undefined;
  }

  return {
    type: memory.type ?? 'user_preference',
    content: memory.content.trim(),
    sourceTaskId,
    agentId: memory.agentId ?? activeAgentId,
    tags: Array.isArray(memory.tags) ? memory.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    importance: memory.importance ?? 3
  };
}

function createPrompt(userText: string) {
  return [
    'Extract durable Bubbles memories from the user message.',
    'Return strict JSON array. Each item: type, content, tags, importance.',
    'Return [] when there is nothing durable to remember.',
    `Message: ${userText}`
  ].join('\n');
}
