import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { type VoiceEvent, type VoiceSessionState } from '@bubbles/core';
import { useVoiceSession } from './useVoiceSession';

describe('useVoiceSession', () => {
  it('starts the voice session through preload and submits final transcripts to chat', async () => {
    const previousBubbles = window.bubbles;
    const restoreMedia = mockMediaCapture();
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const onTranscript = vi.fn().mockResolvedValue(undefined);
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-1', traceId: 'trace-1' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-1' })
    });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn().mockResolvedValue({
            event: { type: 'voice.barge_in', voiceTurnId: 'voice-1' },
            state: createVoiceState({ status: 'listening' })
          }),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          speak: vi.fn(),
          requestMicrophoneAccess: vi.fn().mockResolvedValue({ ok: true, status: 'granted' }),
          startSession,
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn().mockResolvedValue({
            event: { type: 'voice.final', voiceTurnId: 'voice-1', text: 'Help me plan my day.' },
            state: createVoiceState({ status: 'processing', captionText: 'Help me plan my day.' })
          })
        }
      };

      const { result } = renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: 'Ready when you are.',
          onTranscript
        })
      );

      await act(async () => {
        await result.current.startListening();
      });

      expect(startSession).toHaveBeenCalled();

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'Help me plan my day.', confidence: 0.91 },
          createVoiceState({ status: 'processing', captionText: 'Help me plan my day.' })
        );
      });

      await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Help me plan my day.'));
      expect(result.current.voiceState.captionText).toBe('Help me plan my day.');
    } finally {
      window.bubbles = previousBubbles;
      restoreMedia();
    }
  });

  it('stops MiniMax audio when barge-in is requested', async () => {
    const previousBubbles = window.bubbles;
    const bargeIn = vi.fn().mockResolvedValue({
      event: { type: 'voice.barge_in', voiceTurnId: 'voice-1', stoppedTtsId: 'tts-current' },
      state: createVoiceState({ status: 'listening' })
    });
    const stopSpeaking = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn,
          getState: vi.fn().mockResolvedValue(createVoiceState({ status: 'speaking', captionText: 'Long answer.' })),
          onEvent: vi.fn(() => () => undefined),
          speak: vi.fn(),
          startSession: vi.fn(),
          stopSession: vi.fn(),
          stopSpeaking,
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      const { result } = renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: 'Long answer.',
          onTranscript: vi.fn()
        })
      );

      await waitFor(() => expect(result.current.voiceState.status).toBe('speaking'));

      await act(async () => {
        await result.current.bargeIn();
      });

      expect(stopSpeaking).toHaveBeenCalledWith({ ttsId: 'tts-current' });
      expect(bargeIn).toHaveBeenCalledWith({ stoppedTtsId: 'tts-current' });
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('plays assistant replies through MiniMax audio URLs when available', async () => {
    const previousBubbles = window.bubbles;
    const restoreAudio = mockAudioPlayback();
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current', audioUrl: 'bubbles-artifact://local/voice.mp3' });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn(),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      const { rerender } = renderHook(
        ({ latestBubbleText }) =>
          useVoiceSession({
            chatEnabled: true,
            latestBubbleText,
            onTranscript: vi.fn()
          }),
        { initialProps: { latestBubbleText: '' } }
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'Hello Bubbles.' },
          createVoiceState({ status: 'processing', captionText: 'Hello Bubbles.' })
        );
      });

      rerender({ latestBubbleText: 'Short MiniMax reply.' });

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'Short MiniMax reply.', ttsId: 'tts-current' }));
    } finally {
      window.bubbles = previousBubbles;
      restoreAudio();
    }
  });

  it('mirrors voice events without submitting or speaking when side effects are disabled', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const onTranscript = vi.fn();
    const speak = vi.fn();

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn(),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      const { result, rerender } = renderHook(
        ({ latestBubbleText }) =>
          useVoiceSession({
            chatEnabled: true,
            latestBubbleText,
            onTranscript,
            sideEffectsEnabled: false
          }),
        { initialProps: { latestBubbleText: '' } }
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'Hello Bubbles.' },
          createVoiceState({ status: 'processing', captionText: 'Hello Bubbles.' })
        );
      });

      rerender({ latestBubbleText: 'Short MiniMax reply.' });

      expect(result.current.voiceState.captionText).toBe('Hello Bubbles.');
      expect(onTranscript).not.toHaveBeenCalled();
      expect(speak).not.toHaveBeenCalled();
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('uses Hi Bubbles as a wake phrase and submits the remaining command text', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders();
    const onTranscript = vi.fn().mockResolvedValue(undefined);
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-wake-1', traceId: 'trace-1' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-wake-1' })
    });
    const transcribeAudio = vi.fn().mockResolvedValue({
      ok: true,
      event: { type: 'voice.final', voiceTurnId: 'voice-wake-1', text: 'Hi Bubbles change your voice' },
      provider: 'gemini',
      state: createVoiceState({ status: 'processing', captionText: 'Hi Bubbles change your voice' }),
      transcript: 'Hi Bubbles change your voice'
    });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn(() => () => undefined),
          requestMicrophoneAccess: vi.fn().mockResolvedValue({ ok: true, status: 'granted' }),
          speak: vi.fn(),
          startSession,
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn(),
          transcribeAudio
        }
      };

      const { result } = renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          initialWakePhraseEnabled: true,
          latestBubbleText: '',
          onTranscript
        })
      );

      await waitFor(() => expect(media.recorders).toHaveLength(1));

      await act(async () => {
        media.recorders[0]?.emitData(new Blob(['voice'], { type: 'audio/webm' }));
        media.recorders[0]?.stop();
      });

      await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('change your voice'));
      expect(transcribeAudio).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'audio/wav',
          voiceTurnId: 'voice-wake-1'
        })
      );
      expect(result.current.voiceState.captionText).toBe('change your voice');
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it('ignores speech that does not start with the Hi Bubbles wake phrase', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders();
    const onTranscript = vi.fn();
    const stopSession = vi.fn().mockResolvedValue(createVoiceState());

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn(() => () => undefined),
          requestMicrophoneAccess: vi.fn().mockResolvedValue({ ok: true, status: 'granted' }),
          speak: vi.fn(),
          startSession: vi.fn().mockResolvedValue({
            event: { type: 'voice.session_started', voiceTurnId: 'voice-wake-2', traceId: 'trace-2' },
            state: createVoiceState({ status: 'listening', activeTurnId: 'voice-wake-2' })
          }),
          stopSession,
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn(),
          transcribeAudio: vi.fn().mockResolvedValue({
            ok: true,
            event: { type: 'voice.final', voiceTurnId: 'voice-wake-2', text: 'change your voice' },
            provider: 'gemini',
            state: createVoiceState({ status: 'processing', captionText: 'change your voice' }),
            transcript: 'change your voice'
          })
        }
      };

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          initialWakePhraseEnabled: true,
          latestBubbleText: '',
          onTranscript
        })
      );

      await waitFor(() => expect(media.recorders).toHaveLength(1));

      await act(async () => {
        media.recorders[0]?.emitData(new Blob(['voice'], { type: 'audio/webm' }));
        media.recorders[0]?.stop();
      });

      await waitFor(() => expect(stopSession).toHaveBeenCalled());
      expect(onTranscript).not.toHaveBeenCalled();
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it('stops wake listening after terminal STT failure instead of retrying', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders();
    const onTranscript = vi.fn();
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-wake-terminal', traceId: 'trace-terminal' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-wake-terminal' })
    });
    const transcribeAudio = vi.fn().mockResolvedValue({
      ok: false,
      event: {
        type: 'voice.error',
        voiceTurnId: 'voice-wake-terminal',
        error: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.',
        provider: 'gemini'
      },
      provider: 'gemini',
      reason: 'quota',
      retryable: false,
      state: createVoiceState({
        status: 'error',
        captionText: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.',
        lastError: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.'
      })
    });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn(() => () => undefined),
          requestMicrophoneAccess: vi.fn().mockResolvedValue({ ok: true, status: 'granted' }),
          speak: vi.fn(),
          startSession,
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn(),
          transcribeAudio
        }
      };

      const { result } = renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          initialWakePhraseEnabled: true,
          latestBubbleText: '',
          onTranscript
        })
      );

      await waitFor(() => expect(media.recorders).toHaveLength(1));

      await act(async () => {
        media.recorders[0]?.emitData(new Blob(['voice'], { type: 'audio/webm' }));
        media.recorders[0]?.stop();
      });

      await waitFor(() => expect(transcribeAudio).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => window.setTimeout(resolve, 800));

      expect(media.recorders).toHaveLength(1);
      expect(startSession).toHaveBeenCalledTimes(1);
      expect(onTranscript).not.toHaveBeenCalled();
      expect(result.current.voiceState.status).toBe('error');
      expect(result.current.wakePhraseEnabled).toBe(false);
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it('routes final transcripts to voice approval resolution when an approval is pending', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const onTranscript = vi.fn();
    const onApprovalResolved = vi.fn();
    const resolveApproval = vi.fn().mockResolvedValue({
      decision: {
        approvalId: 'approval-1',
        voiceTurnId: 'voice-1',
        decision: 'approved',
        transcript: 'approve'
      },
      message: 'Send email was approved.',
      fallbackRequired: false,
      attemptCount: 0
    });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          resolveApproval,
          startSession: vi.fn(),
          stopSession: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      const { result } = renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: 'Please approve Send email.',
          onApprovalResolved,
          onTranscript,
          pendingApproval: { id: 'approval-1', title: 'Send email' }
        })
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'approve', confidence: 0.92 },
          createVoiceState({ status: 'processing', captionText: 'approve' })
        );
      });

      await waitFor(() =>
        expect(resolveApproval).toHaveBeenCalledWith({
          approvalId: 'approval-1',
          voiceTurnId: 'voice-1',
          transcript: 'approve'
        })
      );
      expect(onApprovalResolved).toHaveBeenCalledWith('Send email was approved.');
      expect(onTranscript).not.toHaveBeenCalled();
      await waitFor(() => expect(result.current.voiceState.captionText).toBe('Send email was approved.'));
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('uses the latest pending approval for an already-subscribed voice listener', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const resolveApproval = vi.fn().mockResolvedValue({
      decision: {
        approvalId: 'approval-1',
        voiceTurnId: 'voice-1',
        decision: 'approved',
        transcript: 'approve'
      },
      message: 'Send email was approved.',
      fallbackRequired: false,
      attemptCount: 0
    });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          resolveApproval,
          startSession: vi.fn(),
          stopSession: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      const { rerender } = renderHook(
        ({ pendingApproval }) =>
          useVoiceSession({
            chatEnabled: true,
            latestBubbleText: 'Ready.',
            onTranscript: vi.fn(),
            pendingApproval
          }),
        { initialProps: { pendingApproval: undefined as { id: string; title: string } | undefined } }
      );

      rerender({ pendingApproval: { id: 'approval-1', title: 'Send email' } });

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'approve', confidence: 0.91 },
          createVoiceState({ status: 'processing', captionText: 'approve' })
        );
      });

      await waitFor(() => expect(resolveApproval).toHaveBeenCalledWith({
        approvalId: 'approval-1',
        voiceTurnId: 'voice-1',
        transcript: 'approve'
      }));
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('keeps the approval in chat fallback mode when voice approval is unclear twice', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const onApprovalResolved = vi.fn();
    const resolveApproval = vi.fn().mockResolvedValue({
      decision: {
        approvalId: 'approval-1',
        voiceTurnId: 'voice-2',
        decision: 'unclear',
        transcript: 'not sure'
      },
      message: 'I could not tell whether to approve Send email. Please use the approval buttons in chat.',
      fallbackRequired: true,
      attemptCount: 2
    });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          resolveApproval,
          startSession: vi.fn(),
          stopSession: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      const { result } = renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: 'Please approve Send email.',
          onApprovalResolved,
          onTranscript: vi.fn(),
          pendingApproval: { id: 'approval-1', title: 'Send email' }
        })
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-2', text: 'not sure', confidence: 0.42 },
          createVoiceState({ status: 'processing', captionText: 'not sure' })
        );
      });

      await waitFor(() =>
        expect(result.current.voiceState.captionText).toBe(
          'I could not tell whether to approve Send email. Please use the approval buttons in chat.'
        )
      );
      expect(result.current.voiceState.status).toBe('idle');
      expect(onApprovalResolved).toHaveBeenCalledWith(
        'I could not tell whether to approve Send email. Please use the approval buttons in chat.'
      );
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('speaks the approval prompt once when an approval becomes pending', async () => {
    const previousBubbles = window.bubbles;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn(() => () => undefined),
          resolveApproval: vi.fn(),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn(),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      const { rerender } = renderHook(
        ({ pendingApproval }) =>
          useVoiceSession({
            chatEnabled: true,
            latestBubbleText: 'Ready.',
            onTranscript: vi.fn(),
            pendingApproval
          }),
        { initialProps: { pendingApproval: undefined as { id: string; title: string } | undefined } }
      );

      rerender({ pendingApproval: { id: 'approval-1', title: 'Send email' } });
      rerender({ pendingApproval: { id: 'approval-1', title: 'Send email' } });

      await waitFor(() =>
        expect(speak).toHaveBeenCalledWith({
          text: 'Approval needed: Send email. Say approve, deny, or cancel.',
          ttsId: 'tts-current'
        })
      );
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
    }
  });
});

function createVoiceState(overrides: Partial<VoiceSessionState> = {}): VoiceSessionState {
  return {
    enabled: true,
    mode: 'push-to-talk',
    provider: 'gemini',
    status: 'idle',
    activeTurnId: undefined,
    partialText: '',
    captionText: '',
    lastError: undefined,
    ...overrides
  };
}

function mockAudioPlayback() {
  const previousAudio = window.Audio;
  class FakeAudio {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';

    constructor(src: string) {
      this.src = src;
    }

    pause = vi.fn();
    play = vi.fn().mockResolvedValue(undefined);
  }
  Object.defineProperty(window, 'Audio', {
    configurable: true,
    value: FakeAudio
  });

  return () => {
    Object.defineProperty(window, 'Audio', {
      configurable: true,
      value: previousAudio
    });
  };
}

function mockMediaCapture() {
  const previousAudioContext = window.AudioContext;
  const previousMediaDevices = navigator.mediaDevices;
  const previousMediaRecorder = window.MediaRecorder;
  const stop = vi.fn();
  class FakeMediaRecorder {
    static isTypeSupported = vi.fn(() => true);
    mimeType = 'audio/webm';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: (() => void) | null = null;
    onstop: (() => void) | null = null;
    state: RecordingState = 'inactive';

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: undefined
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop }]
      })
    }
  });
  Object.defineProperty(window, 'MediaRecorder', {
    configurable: true,
    value: FakeMediaRecorder
  });

  return () => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: previousAudioContext
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: previousMediaDevices
    });
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: previousMediaRecorder
    });
  };
}

function mockMediaCaptureWithRecorders() {
  const previousAudioContext = window.AudioContext;
  const previousMediaDevices = navigator.mediaDevices;
  const previousMediaRecorder = window.MediaRecorder;
  const stop = vi.fn();
  const recorders: Array<{ emitData: (data: Blob) => void; stop: () => void }> = [];

  class FakeRecorder {
    static isTypeSupported = vi.fn(() => true);
    mimeType = 'audio/webm';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: (() => void) | null = null;
    onstop: (() => void) | null = null;
    state: RecordingState = 'inactive';

    constructor() {
      recorders.push(this);
    }

    emitData(data: Blob) {
      this.ondataavailable?.({ data });
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: undefined
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop }]
      })
    }
  });
  Object.defineProperty(window, 'MediaRecorder', {
    configurable: true,
    value: FakeRecorder
  });

  return {
    recorders,
    restore() {
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        value: previousAudioContext
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: previousMediaDevices
      });
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: previousMediaRecorder
      });
    }
  };
}

function createBaseBubbles(): NonNullable<typeof window.bubbles> {
  return {
    closePanel: vi.fn(),
    getState: vi.fn(),
    moveWindowBy: vi.fn(),
    onPanelStateChange: vi.fn(() => () => undefined),
    onStateChange: vi.fn(() => () => undefined),
    platform: 'darwin',
    phase: 'phase-6-8',
    sendMessage: vi.fn(),
    setAvatarState: vi.fn(),
    setup: {
      getStatus: vi.fn(),
      resetAllMiniMax: vi.fn(),
      resetTokenPlanKey: vi.fn(),
      retry: vi.fn(),
      saveTokenPlanKey: vi.fn()
    },
    togglePanel: vi.fn()
  };
}
