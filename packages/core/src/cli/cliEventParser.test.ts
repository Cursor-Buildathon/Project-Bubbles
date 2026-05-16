import { describe, expect, it } from 'vitest';
import { createCliEventParser, extractMiniMaxResponseText } from './cliEventParser.js';

describe('createCliEventParser', () => {
  it('normalizes stdout, stderr, JSON lines, malformed output, approvals, and process exits', () => {
    const parser = createCliEventParser('task-1');

    expect(parser.parseStdout('plain progress')).toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        type: 'task.partial_output',
        payload: { stream: 'stdout', text: 'plain progress' }
      })
    ]);
    expect(parser.parseStderr('warning')).toEqual([
      expect.objectContaining({
        type: 'task.status',
        payload: { level: 'error', text: 'warning' }
      })
    ]);
    expect(parser.parseStdout('{"type":"approval.required","payload":{"title":"Send email"}}\n')).toEqual([
      expect.objectContaining({
        type: 'approval.required',
        payload: { title: 'Send email' }
      })
    ]);
    expect(parser.parseStdout('{not json}\n')).toEqual([
      expect.objectContaining({
        type: 'task.partial_output',
        payload: { stream: 'stdout', text: '{not json}' }
      })
    ]);
    expect(parser.parseStdout('I need more information from you.')).toEqual([
      expect.objectContaining({
        type: 'task.status',
        payload: { status: 'missing_info', text: 'I need more information from you.' }
      })
    ]);
    expect(parser.parseExit(0)).toEqual(
      expect.objectContaining({
        type: 'task.result',
        payload: { exitCode: 0 }
      })
    );
    expect(parser.parseExit(2)).toEqual(
      expect.objectContaining({
        type: 'task.error',
        payload: { exitCode: 2 }
      })
    );
  });

  it('turns MiniMax JSON errors into rich task errors', () => {
    const parser = createCliEventParser('task-network');
    const events = parser.parseStderr(
      JSON.stringify({
        error: {
          code: 6,
          message: 'Network request failed.',
          hint: 'Check your network connection.\nTo use a proxy: set HTTPS_PROXY env var.'
        }
      })
    );

    expect(events).toEqual([
      expect.objectContaining({
        taskId: 'task-network',
        type: 'task.error',
        payload: {
          category: 'network',
          errorCode: 6,
          errorMessage:
            'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.',
          hint: 'Check your network connection.\nTo use a proxy: set HTTPS_PROXY env var.',
          rawMessage: 'Network request failed.'
        }
      })
    ]);
  });

  it('turns pretty MiniMax JSON errors into rich task errors', () => {
    const parser = createCliEventParser('task-network');
    const events = parser.parseStderr(
      JSON.stringify(
        {
          error: {
            code: 6,
            message: 'Network request failed.',
            hint: 'Check your network connection.'
          }
        },
        null,
        2
      )
    );

    expect(events).toEqual([
      expect.objectContaining({
        taskId: 'task-network',
        type: 'task.error',
        payload: expect.objectContaining({
          category: 'network',
          errorCode: 6,
          rawMessage: 'Network request failed.'
        })
      })
    ]);
  });

  it('extracts assistant text from MiniMax pretty JSON without exposing thinking text', () => {
    expect(
      extractMiniMaxResponseText(
        JSON.stringify(
          {
            id: '06551d4d097cfad0a6d9640db0802943',
            type: 'message',
            role: 'assistant',
            model: 'MiniMax-M2.7',
            content: [
              {
                thinking: 'The user has sent a simple greeting.',
                signature: 'signature',
                type: 'thinking'
              },
              {
                text: 'Hi! How can I help you today?',
                type: 'text'
              }
            ]
          },
          null,
          2
        )
      )
    ).toBe('Hi! How can I help you today?');
  });
});
