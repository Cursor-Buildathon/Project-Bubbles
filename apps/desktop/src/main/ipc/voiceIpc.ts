import {
  createInitialVoiceSessionState,
  detectAffect,
  type VoiceEvent,
  type VoiceProvider,
  type VoiceSessionState
} from '@bubbles/core';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

interface IpcMainLike {
  handle: (channel: string, handler: IpcHandler) => void;
}

interface VoiceIpcControllerOptions {
  enabled: boolean;
  provider?: VoiceProvider;
  publish: (event: VoiceEvent, state: VoiceSessionState) => void;
  speakText?: (input: { text: string; ttsId: string }) => Promise<VoiceSpeakResult>;
  stopSpeaking?: (input?: { ttsId?: string }) => VoiceSpeakResult;
}

interface SubmitTranscriptInput {
  text: string;
  confidence?: number;
  provider?: VoiceProvider;
}

interface BargeInInput {
  stoppedTtsId?: string;
}

interface SpeakInput {
  text: string;
  ttsId?: string;
}

interface VoiceIpcResult {
  event: VoiceEvent;
  state: VoiceSessionState;
}

export interface VoiceSpeakResult {
  ok: boolean;
  ttsId: string;
  error?: string;
}

export function createVoiceIpcController({
  enabled,
  provider = 'native-macos',
  publish,
  speakText,
  stopSpeaking
}: VoiceIpcControllerOptions) {
  let state = createInitialVoiceSessionState({ enabled, provider });

  function setState(nextState: VoiceSessionState, event: VoiceEvent): VoiceIpcResult {
    state = nextState;
    publish(event, state);
    return { event, state };
  }

  function createDisabledResult(): VoiceIpcResult {
    const error = 'Voice is disabled.';
    const event: VoiceEvent = {
      type: 'voice.error',
      error,
      provider: state.provider
    };
    return setState(createInitialVoiceSessionState({ ...state, status: 'error', lastError: error }), event);
  }

  return {
    getState: () => state,
    startSession(): VoiceIpcResult {
      if (!state.enabled) {
        return createDisabledResult();
      }

      const voiceTurnId = createId('voice');
      const traceId = createId('trace');
      const event: VoiceEvent = {
        type: 'voice.session_started',
        voiceTurnId,
        traceId
      };

      return setState(
        createInitialVoiceSessionState({
          ...state,
          status: 'listening',
          activeTurnId: voiceTurnId,
          partialText: '',
          captionText: '',
          lastError: undefined
        }),
        event
      );
    },
    stopSession(): VoiceSessionState {
      state = createInitialVoiceSessionState({
        ...state,
        status: 'idle',
        activeTurnId: undefined,
        partialText: '',
        lastError: undefined
      });
      return state;
    },
    submitPartialTranscript(input: SubmitTranscriptInput): VoiceIpcResult {
      if (!state.enabled) {
        return createDisabledResult();
      }

      const text = input.text.trim();
      const voiceTurnId = state.activeTurnId ?? createId('voice');
      const event: VoiceEvent = {
        type: 'voice.partial',
        voiceTurnId,
        text,
        confidence: input.confidence
      };

      return setState(
        createInitialVoiceSessionState({
          ...state,
          provider: input.provider ?? state.provider,
          status: 'listening',
          activeTurnId: voiceTurnId,
          partialText: text,
          captionText: text,
          lastError: undefined
        }),
        event
      );
    },
    submitTranscript(input: SubmitTranscriptInput): VoiceIpcResult {
      if (!state.enabled) {
        return createDisabledResult();
      }

      const text = input.text.trim();
      const voiceTurnId = state.activeTurnId ?? createId('voice');
      const affect = detectAffect({ text });
      const event: VoiceEvent = {
        type: 'voice.final',
        voiceTurnId,
        text,
        confidence: input.confidence,
        affect
      };

      return setState(
        createInitialVoiceSessionState({
          ...state,
          provider: input.provider ?? state.provider,
          status: 'processing',
          activeTurnId: voiceTurnId,
          partialText: '',
          captionText: text,
          lastError: undefined
        }),
        event
      );
    },
    bargeIn(input: BargeInInput = {}): VoiceIpcResult {
      stopSpeaking?.({ ttsId: input.stoppedTtsId });
      const voiceTurnId = state.activeTurnId ?? createId('voice');
      const event: VoiceEvent = {
        type: 'voice.barge_in',
        voiceTurnId,
        stoppedTtsId: input.stoppedTtsId
      };

      return setState(
        createInitialVoiceSessionState({
          ...state,
          status: 'listening',
          activeTurnId: voiceTurnId,
          captionText: '',
          lastError: undefined
        }),
        event
      );
    },
    speak(input: SpeakInput): Promise<VoiceSpeakResult> {
      if (!state.enabled) {
        return Promise.resolve({ ok: false, ttsId: input.ttsId ?? 'tts-current', error: 'Voice is disabled.' });
      }

      const text = input.text.trim();
      const ttsId = input.ttsId ?? createId('tts');

      if (!text) {
        return Promise.resolve({ ok: false, ttsId, error: 'Speech text is empty.' });
      }

      return speakText?.({ text, ttsId }) ?? Promise.resolve({ ok: false, ttsId, error: 'Native speech is unavailable.' });
    },
    stopSpeaking(input: { ttsId?: string } = {}): VoiceSpeakResult {
      return stopSpeaking?.(input) ?? { ok: true, ttsId: input.ttsId ?? 'tts-current' };
    }
  };
}

export function registerVoiceIpc(ipcMain: IpcMainLike, controller: ReturnType<typeof createVoiceIpcController>) {
  ipcMain.handle('voice:get-state', () => controller.getState());
  ipcMain.handle('voice:start-session', () => controller.startSession());
  ipcMain.handle('voice:stop-session', () => controller.stopSession());
  ipcMain.handle('voice:submit-partial-transcript', (_event, input) =>
    controller.submitPartialTranscript(parseSubmitTranscriptInput(input))
  );
  ipcMain.handle('voice:submit-transcript', (_event, input) => controller.submitTranscript(parseSubmitTranscriptInput(input)));
  ipcMain.handle('voice:barge-in', (_event, input) => controller.bargeIn(parseBargeInInput(input)));
  ipcMain.handle('voice:speak', (_event, input) => controller.speak(parseSpeakInput(input)));
  ipcMain.handle('voice:stop-speaking', (_event, input) => controller.stopSpeaking(parseSpeakInput(input)));
}

function parseSubmitTranscriptInput(input: unknown): SubmitTranscriptInput {
  if (!input || typeof input !== 'object') {
    return { text: '' };
  }

  const record = input as Record<string, unknown>;
  return {
    text: typeof record.text === 'string' ? record.text : '',
    confidence: typeof record.confidence === 'number' ? record.confidence : undefined,
    provider: record.provider === 'fixture-transcript' || record.provider === 'native-macos' ? record.provider : undefined
  };
}

function parseBargeInInput(input: unknown): BargeInInput {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const record = input as Record<string, unknown>;
  return {
    stoppedTtsId: typeof record.stoppedTtsId === 'string' ? record.stoppedTtsId : undefined
  };
}

function parseSpeakInput(input: unknown): SpeakInput {
  if (!input || typeof input !== 'object') {
    return { text: '' };
  }

  const record = input as Record<string, unknown>;
  return {
    text: typeof record.text === 'string' ? record.text : '',
    ttsId: typeof record.ttsId === 'string' ? record.ttsId : undefined
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
