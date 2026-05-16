import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCliEventParser, createEvent, extractMiniMaxResponseText } from './cliEventParser.js';
import { redactSecrets } from '../security/redactSecrets.js';
import { type CliEvent, type TaskPacket } from '../shared/types.js';

export interface CliCommand {
  command: string;
  args: string[];
}

export interface CliBridge {
  cancel: (taskId: string) => boolean;
  start: (packet: TaskPacket, onEvent: (event: CliEvent) => void) => Promise<CliEvent>;
}

export interface CliBridgeOptions {
  logDir: string;
  preflight?: () => Promise<CliPreflightResult>;
  resolveCommand?: (packet: TaskPacket) => CliCommand;
  stalledTimeoutMs?: number;
}

export type CliPreflightResult =
  | { ok: true }
  | {
      ok: false;
      category?: string;
      error: string;
      hint?: string;
    };

export function createCliBridge({
  logDir,
  preflight,
  resolveCommand = createMiniMaxCommand,
  stalledTimeoutMs = 120_000
}: CliBridgeOptions): CliBridge {
  const runningTasks = new Map<string, ChildProcessWithoutNullStreams>();
  const knownTasks = new Set<string>();
  const pendingCancels = new Set<string>();

  return {
    cancel(taskId) {
      const child = runningTasks.get(taskId);

      if (!child) {
        if (!knownTasks.has(taskId)) {
          return false;
        }

        pendingCancels.add(taskId);
        return true;
      }

      pendingCancels.delete(taskId);
      child.kill('SIGTERM');
      return true;
    },

    async start(packet, onEvent) {
      return new Promise<CliEvent>((resolve) => {
        const parser = createCliEventParser(packet.taskId);
        const logPath = join(logDir, `${packet.taskId}.log`);
        let settled = false;
        let cancelled = false;
        let richErrorEvent: CliEvent | undefined;
        let richResultEvent: CliEvent | undefined;
        let stdoutBuffer = '';
        let stderrBuffer = '';
        let timeout: NodeJS.Timeout | undefined;
        let child: ChildProcessWithoutNullStreams | undefined;

        const emit = (event: CliEvent) => {
          void appendTaskLog(logDir, logPath, JSON.stringify(event));
          onEvent(event);
        };

        const settle = (event: CliEvent) => {
          if (settled) {
            return;
          }

          const finalEvent = event.type === 'task.error' && richErrorEvent ? richErrorEvent : event;
          settled = true;
          if (timeout) {
            clearTimeout(timeout);
          }
          runningTasks.delete(packet.taskId);
          knownTasks.delete(packet.taskId);
          pendingCancels.delete(packet.taskId);
          emit(finalEvent);
          resolve(finalEvent);
        };

        const resetTimeout = () => {
          if (timeout) {
            clearTimeout(timeout);
          }

          timeout = setTimeout(() => {
            if (settled) {
              return;
            }

            child?.kill('SIGTERM');
            settle(
              createEvent(packet.taskId, 'task.error', {
                reason: 'stalled_timeout',
                timeoutMs: stalledTimeoutMs
              })
            );
          }, stalledTimeoutMs);
        };

        void appendTaskLog(logDir, logPath, JSON.stringify({ packet }));
        knownTasks.add(packet.taskId);
        emit(createEvent(packet.taskId, 'task.received', { activeAgentId: packet.activeAgentId }));

        void (async () => {
          if (pendingCancels.has(packet.taskId)) {
            settle(createEvent(packet.taskId, 'task.cancelled', { signal: 'SIGTERM' }));
            return;
          }

          const preflightEvent = await runPreflight(packet.taskId, preflight);

          if (preflightEvent) {
            settle(preflightEvent);
            return;
          }

          if (pendingCancels.has(packet.taskId)) {
            settle(createEvent(packet.taskId, 'task.cancelled', { signal: 'SIGTERM' }));
            return;
          }

          const command = resolveCommand(packet);
          void appendTaskLog(logDir, logPath, JSON.stringify({ command: command.command, args: command.args }));
          resetTimeout();

          try {
            child = spawn(command.command, command.args, {
              env: process.env,
              shell: false,
              windowsHide: true
            });
          } catch (error) {
            settle(createEvent(packet.taskId, 'task.error', { error: redactSecrets(error) }));
            return;
          }

          runningTasks.set(packet.taskId, child);

          child.stdout.on('data', (chunk: Buffer) => {
            resetTimeout();
            const text = chunk.toString('utf8');
            stdoutBuffer += text;
            const jsonOutput = classifyJsonOutput(stdoutBuffer);

            if (jsonOutput === 'incomplete' || jsonOutput === 'response') {
              return;
            }

            const parseTarget = jsonOutput === 'event' ? stdoutBuffer : text;
            parser.parseStdout(parseTarget).forEach((event) => {
              if (event.type === 'task.error') {
                richErrorEvent = event;
                return;
              }

              if (event.type === 'task.result') {
                richResultEvent = event;
                return;
              }

              emit(event);
            });
            if (jsonOutput === 'event') {
              stdoutBuffer = '';
            }
          });
          child.stderr.on('data', (chunk: Buffer) => {
            resetTimeout();
            const text = chunk.toString('utf8');
            stderrBuffer += text;

            if (classifyJsonOutput(stderrBuffer) === 'incomplete') {
              return;
            }

            parser.parseStderr(stderrBuffer).forEach((event) => {
              if (event.type === 'task.error') {
                richErrorEvent = event;
                return;
              }

              if (event.type === 'task.result') {
                richResultEvent = event;
                return;
              }

              emit(event);
            });
            stderrBuffer = '';
          });
          child.on('error', (error) => {
            settle(createEvent(packet.taskId, 'task.error', { error: redactSecrets(error) }));
          });
          child.on('close', (exitCode, signal) => {
            if (settled) {
              return;
            }

            if (stderrBuffer.trim()) {
              parser.parseStderr(stderrBuffer).forEach((event) => {
                if (event.type === 'task.error') {
                  richErrorEvent = event;
                }
              });
            }

            if (cancelled || signal === 'SIGTERM') {
              settle(createEvent(packet.taskId, 'task.cancelled', { signal: signal ?? 'SIGTERM' }));
              return;
            }

            if ((exitCode ?? 1) === 0 && richResultEvent) {
              settle(richResultEvent);
              return;
            }

            const resultText = extractMiniMaxResponseText(stdoutBuffer) ?? extractPlainResponseText(stdoutBuffer);
            if ((exitCode ?? 1) === 0 && resultText) {
              settle(
                createEvent(packet.taskId, 'task.result', {
                  exitCode: 0,
                  text: resultText
                })
              );
              return;
            }

            settle(parser.parseExit(exitCode));
          });

          const originalKill = child.kill.bind(child);
          child.kill = ((signal?: NodeJS.Signals | number) => {
            cancelled = signal !== undefined;
            return originalKill(signal);
          }) as ChildProcessWithoutNullStreams['kill'];
        })().catch((error) => {
          settle(
            createEvent(packet.taskId, 'task.error', {
              error: redactSecrets(error),
              preflight: true
            })
          );
        });
      });
    }
  };
}

function classifyJsonOutput(text: string): 'event' | 'incomplete' | 'response' | 'text' {
  const trimmed = text.trimStart();

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return 'text';
  }

  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown; type?: unknown };

    if (!Array.isArray(parsed) && (parsed.error || isKnownEventType(parsed.type))) {
      return 'event';
    }

    return 'response';
  } catch {
    return 'incomplete';
  }
}

function isKnownEventType(type: unknown) {
  return (
    typeof type === 'string' &&
    [
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
    ].includes(type)
  );
}

function extractPlainResponseText(rawOutput: string) {
  const compact = redactSecrets(rawOutput).replace(/\s+/g, ' ').trim();

  if (!compact || compact.startsWith('{') || compact.startsWith('[')) {
    return undefined;
  }

  return compact;
}

async function runPreflight(taskId: string, preflight: CliBridgeOptions['preflight']) {
  if (!preflight) {
    return undefined;
  }

  const result = await preflight();

  if (result.ok) {
    return undefined;
  }

  return createEvent(taskId, 'task.error', {
    category: result.category ?? 'unknown',
    errorMessage: result.error,
    hint: result.hint,
    preflight: true
  });
}

function createMiniMaxCommand(packet: TaskPacket): CliCommand {
  return {
    command: 'mmx',
    args: [
      'text',
      'chat',
      '--message',
      [
        'You are the CLI worker for Bubbles. Use this structured task packet as context.',
        JSON.stringify(packet)
      ].join('\n\n')
    ]
  };
}

async function appendTaskLog(logDir: string, logPath: string, line: string) {
  await mkdir(logDir, { recursive: true });
  await appendFile(logPath, `${redactSecrets(line)}\n`, 'utf8');
}
