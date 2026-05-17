import { describe, expect, it } from 'vitest';
import { createMemoryExtractor, parseExplicitRememberCommand } from './memoryExtractor.js';

describe('parseExplicitRememberCommand', () => {
  it('extracts explicit remember content', () => {
    expect(parseExplicitRememberCommand('Remember I like short plans.')).toBe('I like short plans.');
    expect(parseExplicitRememberCommand('remember that my demo is Friday')).toBe('my demo is Friday');
    expect(parseExplicitRememberCommand('please remember this later')).toBeUndefined();
  });
});

describe('createMemoryExtractor', () => {
  it('normalizes MiniMax memory extraction output', async () => {
    const extractor = createMemoryExtractor({
      generateJson: async () => [
        {
          type: 'user_preference',
          content: 'Prefers concise status updates.',
          tags: ['style'],
          importance: 4
        }
      ]
    });

    await expect(
      extractor.extract({
        activeAgentId: 'general-assistant',
        sourceTaskId: 'task-1',
        userText: 'I prefer concise updates.'
      })
    ).resolves.toEqual([
      {
        type: 'user_preference',
        content: 'Prefers concise status updates.',
        sourceTaskId: 'task-1',
        agentId: 'general-assistant',
        tags: ['style'],
        importance: 4
      }
    ]);
  });

  it('returns no memories when MiniMax output cannot be parsed as JSON', async () => {
    const extractor = createMemoryExtractor({
      generateJson: async () => {
        throw new SyntaxError('Unexpected token <');
      }
    });

    await expect(
      extractor.extract({
        activeAgentId: 'general-assistant',
        userText: 'Research the safest MVP path for connecting MCP tools.'
      })
    ).resolves.toEqual([]);
  });
});
