import { spawn } from 'node:child_process';

interface SpeechProcess {
  kill(signal?: NodeJS.Signals): boolean;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

interface SpeechPlaybackOptions {
  runSay?: (text: string) => SpeechProcess;
}

export interface SpeechPlaybackResult {
  ok: boolean;
  ttsId: string;
  error?: string;
}

export interface SpeechPlaybackController {
  speak(input: { text: string; ttsId: string }): Promise<SpeechPlaybackResult>;
  stop(input?: { ttsId?: string }): SpeechPlaybackResult;
}

export function createNativeSpeechPlayback({ runSay = defaultRunSay }: SpeechPlaybackOptions = {}): SpeechPlaybackController {
  let active: { ttsId: string; process: SpeechProcess } | undefined;

  return {
    async speak({ text, ttsId }) {
      const trimmedText = text.trim();

      if (!trimmedText) {
        return { ok: false, ttsId, error: 'Speech text is empty.' };
      }

      active?.process.kill();
      const child = runSay(trimmedText);
      active = { ttsId, process: child };

      return new Promise<SpeechPlaybackResult>((resolve) => {
        child.once('error', (error) => {
          if (active?.ttsId === ttsId) {
            active = undefined;
          }
          resolve({ ok: false, ttsId, error: error.message });
        });
        child.once('exit', (code, signal) => {
          if (active?.ttsId === ttsId) {
            active = undefined;
          }
          resolve({ ok: code === 0 || signal === 'SIGTERM', ttsId });
        });
      });
    },
    stop(input) {
      if (!active || (input?.ttsId && input.ttsId !== active.ttsId)) {
        return { ok: true, ttsId: input?.ttsId ?? 'tts-current' };
      }

      const { ttsId, process } = active;
      active = undefined;
      process.kill('SIGTERM');
      return { ok: true, ttsId };
    }
  };
}

function defaultRunSay(text: string): SpeechProcess {
  return spawn('say', [text], { stdio: 'ignore' });
}
