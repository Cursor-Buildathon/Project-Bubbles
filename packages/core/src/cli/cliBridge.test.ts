import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createCliBridge } from './cliBridge.js';
import { type CliEvent, type TaskPacket } from '../shared/types.js';

describe('createCliBridge', () => {
  it('streams process output and emits a result event', async () => {
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      resolveCommand: () => ({
        command: process.execPath,
        args: ['-e', "console.log('hello from fixture')"]
      })
    });
    const events: CliEvent[] = [];
    const result = await bridge.start(createPacket('task-stream'), (event) => events.push(event));

    expect(result.type).toBe('task.result');
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'task.received' }),
        expect.objectContaining({ type: 'task.partial_output', payload: { stream: 'stdout', text: 'hello from fixture' } }),
        expect.objectContaining({ type: 'task.result' })
      ])
    );
  });

  it('emits a preflight error and does not spawn the task command when health check fails', async () => {
    let taskSpawned = false;
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      preflight: async () => ({
        ok: false,
        error:
          'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.',
        category: 'network',
        hint: 'Check your network connection.'
      }),
      resolveCommand: () => {
        taskSpawned = true;
        return {
          command: process.execPath,
          args: ['-e', "console.log('should not run')"]
        };
      }
    });
    const events: CliEvent[] = [];
    const result = await bridge.start(createPacket('task-preflight'), (event) => events.push(event));

    expect(taskSpawned).toBe(false);
    expect(result).toEqual(
      expect.objectContaining({
        type: 'task.error',
        payload: expect.objectContaining({
          category: 'network',
          errorMessage:
            'MiniMax CLI cannot reach the network right now. Check your connection or proxy settings, then use Recheck CLI.'
        })
      })
    );
    expect(events).toEqual([
      expect.objectContaining({ type: 'task.received' }),
      expect.objectContaining({ type: 'task.error' })
    ]);
  });

  it('keeps the rich MiniMax runtime error instead of replacing it with a vague exit error', async () => {
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      resolveCommand: () => ({
        command: process.execPath,
        args: [
          '-e',
          `console.error(${JSON.stringify(
            JSON.stringify({
              error: {
                code: 6,
                message: 'Network request failed.',
                hint: 'Check your network connection.'
              }
            })
          )}); process.exit(1);`
        ]
      })
    });
    const events: CliEvent[] = [];
    const result = await bridge.start(createPacket('task-runtime-network'), (event) => events.push(event));

    expect(result).toEqual(
      expect.objectContaining({
        type: 'task.error',
        payload: expect.objectContaining({
          category: 'network',
          errorCode: 6,
          rawMessage: 'Network request failed.'
        })
      })
    );
    expect(events.filter((event) => event.type === 'task.error')).toHaveLength(1);
  });

  it('turns pretty MiniMax JSON output into a concise task result without streaming JSON fragments', async () => {
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      resolveCommand: () => ({
        command: process.execPath,
        args: [
          '-e',
          `console.log(${JSON.stringify(
            JSON.stringify(
              {
                type: 'message',
                role: 'assistant',
                content: [
                  { type: 'thinking', thinking: 'Private thinking should not appear.' },
                  { type: 'text', text: 'Hi! How can I help you today?' }
                ]
              },
              null,
              2
            )
          )})`
        ]
      })
    });
    const events: CliEvent[] = [];
    const result = await bridge.start(createPacket('task-json-output'), (event) => events.push(event));

    expect(result).toEqual(
      expect.objectContaining({
        type: 'task.result',
        payload: expect.objectContaining({
          text: 'Hi! How can I help you today?'
        })
      })
    );
    expect(events.some((event) => event.type === 'task.partial_output' && String(event.payload.text).includes('thinking'))).toBe(
      false
    );
  });

  it('uses plain stdout as the task result when the CLI does not emit JSON', async () => {
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      resolveCommand: () => ({
        command: process.execPath,
        args: ['-e', "console.log('plain answer from minimax')"]
      })
    });
    const events: CliEvent[] = [];
    const result = await bridge.start(createPacket('task-plain-output'), (event) => events.push(event));

    expect(result).toEqual(
      expect.objectContaining({
        type: 'task.result',
        payload: expect.objectContaining({
          text: 'plain answer from minimax'
        })
      })
    );
  });

  it('uses a structured JSON task result without duplicating the exit result', async () => {
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      resolveCommand: () => ({
        command: process.execPath,
        args: ['-e', 'console.log(JSON.stringify({ type: "task.result", payload: { text: "structured result" } }))']
      })
    });
    const events: CliEvent[] = [];
    const result = await bridge.start(createPacket('task-structured-result'), (event) => events.push(event));

    expect(result).toEqual(
      expect.objectContaining({
        type: 'task.result',
        payload: { text: 'structured result' }
      })
    );
    expect(events.filter((event) => event.type === 'task.result')).toHaveLength(1);
  });

  it('keeps pretty MiniMax JSON errors rich even when they arrive across stderr chunks', async () => {
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      resolveCommand: () => ({
        command: process.execPath,
        args: [
          '-e',
          [
            'const error = JSON.stringify({ error: { code: 6, message: "Network request failed.", hint: "Check connection." } }, null, 2);',
            'process.stderr.write(error.slice(0, 20));',
            'setTimeout(() => { process.stderr.write(error.slice(20)); process.exit(1); }, 20);'
          ].join('')
        ]
      })
    });
    const events: CliEvent[] = [];
    const result = await bridge.start(createPacket('task-pretty-error'), (event) => events.push(event));

    expect(result).toEqual(
      expect.objectContaining({
        type: 'task.error',
        payload: expect.objectContaining({
          category: 'network',
          errorCode: 6,
          rawMessage: 'Network request failed.'
        })
      })
    );
    expect(events.filter((event) => event.type === 'task.error')).toHaveLength(1);
  });

  it('cancels a running task', async () => {
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      resolveCommand: () => ({
        command: process.execPath,
        args: ['-e', 'setInterval(() => console.log("tick"), 50)']
      })
    });
    const events: CliEvent[] = [];
    const running = bridge.start(createPacket('task-cancel'), (event) => events.push(event));

    await new Promise((resolve) => setTimeout(resolve, 80));
    bridge.cancel('task-cancel');
    const result = await running;

    expect(result.type).toBe('task.cancelled');
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'task.cancelled' })]));
  });

  it('does not remember cancellation requests for unknown tasks', () => {
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`)
    });

    expect(bridge.cancel('task-missing')).toBe(false);
  });

  it('honors cancellation requested before the child process is registered', async () => {
    let releasePreflight: (() => void) | undefined;
    const bridge = createCliBridge({
      logDir: join(tmpdir(), `bubbles-cli-logs-${Date.now()}`),
      preflight: () =>
        new Promise((resolve) => {
          releasePreflight = () => resolve({ ok: true });
        }),
      resolveCommand: () => ({
        command: process.execPath,
        args: ['-e', 'setInterval(() => console.log("tick"), 50)']
      })
    });
    const events: CliEvent[] = [];
    const running = bridge.start(createPacket('task-early-cancel'), (event) => events.push(event));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(bridge.cancel('task-early-cancel')).toBe(true);
    releasePreflight?.();
    const result = await running;

    expect(result.type).toBe('task.cancelled');
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'task.cancelled' })]));
  });

  it('times out stalled commands and redacts secrets in task logs', async () => {
    const logDir = join(tmpdir(), `bubbles-cli-logs-${Date.now()}`);
    const bridge = createCliBridge({
      logDir,
      stalledTimeoutMs: 40,
      resolveCommand: () => ({
        command: process.execPath,
        args: ['-e', "setTimeout(() => console.error('sk-cp-secret'), 500)"]
      })
    });
    const events: CliEvent[] = [];
    const result = await bridge.start(createPacket('task-timeout'), (event) => events.push(event));
    const log = await readFile(join(logDir, 'task-timeout.log'), 'utf8');

    expect(result.type).toBe('task.error');
    expect(result.payload).toMatchObject({ reason: 'stalled_timeout' });
    expect(log).not.toContain('sk-cp-secret');
    expect(log).toContain('[REDACTED]');
  });
});

function createPacket(taskId: string): TaskPacket {
  return {
    taskId,
    userText: 'Say hello',
    activeAgentId: 'general-assistant',
    taskType: 'general.plan',
    mode: 'plan_then_act',
    memoryContext: [],
    skillsMarkdown: '# Skills',
    allowedTools: ['minimax.text'],
    approvalPolicy: 'preview_sensitive_actions',
    outputPreference: {
      userLevel: 'nontechnical',
      responseStyle: 'clear_spoken_summary',
      includeTechnicalDetails: false
    }
  };
}
