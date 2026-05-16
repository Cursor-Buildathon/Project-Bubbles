import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { type VoiceEvent, type VoiceSessionState } from '@bubbles/core';
import { useVoiceSession } from './useVoiceSession';

describe('useVoiceSession', () => {
  it('starts the voice session through preload and submits final transcripts to chat', async () => {
    const previousBubbles = window.bubbles;
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
    }
  });

  it('cancels speech synthesis when barge-in is requested', async () => {
    const previousBubbles = window.bubbles;
    const cancel = vi.fn();
    const bargeIn = vi.fn().mockResolvedValue({
      event: { type: 'voice.barge_in', voiceTurnId: 'voice-1', stoppedTtsId: 'tts-current' },
      state: createVoiceState({ status: 'listening' })
    });
    const stopSpeaking = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });

    try {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: { cancel, speak: vi.fn() }
      });
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

      expect(cancel).toHaveBeenCalled();
      expect(stopSpeaking).toHaveBeenCalledWith({ ttsId: 'tts-current' });
      expect(bargeIn).toHaveBeenCalledWith({ stoppedTtsId: 'tts-current' });
    } finally {
      window.bubbles = previousBubbles;
      Reflect.deleteProperty(window, 'speechSynthesis');
    }
  });

  it('plays assistant replies through the native speech IPC when available', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });

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

      rerender({ latestBubbleText: 'Short native reply.' });

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'Short native reply.', ttsId: 'tts-current' }));
    } finally {
      window.bubbles = previousBubbles;
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
    provider: 'native-macos',
    status: 'idle',
    activeTurnId: undefined,
    partialText: '',
    captionText: '',
    lastError: undefined,
    ...overrides
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
      installCli: vi.fn(),
      resetAllMiniMax: vi.fn(),
      resetGeneralApiKey: vi.fn(),
      resetTokenPlanKey: vi.fn(),
      retry: vi.fn(),
      saveGeneralApiKey: vi.fn(),
      saveTokenPlanKey: vi.fn()
    },
    togglePanel: vi.fn()
  };
}
