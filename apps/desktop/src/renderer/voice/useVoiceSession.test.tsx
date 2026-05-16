import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { type VoiceEvent, type VoiceSessionState } from '@bubbles/core';
import { useVoiceSession } from './useVoiceSession';

const chatPanelPrompt = 'Please look in the chat panel for the response.';

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

  it('speaks flagged image-generation messages once even when the request was typed', async () => {
    const previousBubbles = window.bubbles;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn(() => () => undefined),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn(),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      const { rerender } = renderHook(
        ({ latestBubbleMessageId, latestBubbleSpeakOnArrival, latestBubbleText }) =>
          useVoiceSession({
            chatEnabled: true,
            latestBubbleMessageId,
            latestBubbleSpeakOnArrival,
            latestBubbleText,
            onTranscript: vi.fn()
          }),
        { initialProps: { latestBubbleMessageId: 1, latestBubbleSpeakOnArrival: false, latestBubbleText: '' } }
      );

      rerender({
        latestBubbleMessageId: 2,
        latestBubbleSpeakOnArrival: true,
        latestBubbleText: 'The image is ready.'
      });
      rerender({
        latestBubbleMessageId: 2,
        latestBubbleSpeakOnArrival: true,
        latestBubbleText: 'The image is ready.'
      });

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'The image is ready.', ttsId: 'tts-current' }));
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('asks the user to look in chat instead of speaking long assistant replies', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });
    const longReply = 'I finished the task and put a complete explanation with next steps in the chat panel.';

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

      rerender({ latestBubbleText: longReply });

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: chatPanelPrompt, ttsId: 'tts-current' }));
      expect(speak).not.toHaveBeenCalledWith({ text: longReply, ttsId: 'tts-current' });
    } finally {
      window.bubbles = previousBubbles;
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

  it('does not start a paid wake transcription loop when the panel mounts', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders();
    const startSession = vi.fn();
    const transcribeAudio = vi.fn();

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

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: '',
          onTranscript: vi.fn()
        })
      );

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      });

      expect(media.recorders).toHaveLength(0);
      expect(startSession).not.toHaveBeenCalled();
      expect(transcribeAudio).not.toHaveBeenCalled();
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it('starts one command capture from the voice shortcut event', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders();
    let shortcutCallback: (() => void) | undefined;
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-shortcut-1', traceId: 'trace-2' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-shortcut-1' })
    });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn(() => () => undefined),
          onShortcutStart: vi.fn((callback) => {
            shortcutCallback = callback;
            return () => undefined;
          }),
          requestMicrophoneAccess: vi.fn().mockResolvedValue({ ok: true, status: 'granted' }),
          speak: vi.fn(),
          startSession,
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn(),
          transcribeAudio: vi.fn()
        }
      };

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: '',
          onTranscript: vi.fn()
        })
      );

      await waitFor(() => expect(shortcutCallback).toBeDefined());

      await act(async () => {
        shortcutCallback?.();
      });

      await waitFor(() => expect(media.recorders).toHaveLength(1));
      expect(startSession).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it('does not create duplicate recorders from repeated shortcut events while active', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders();
    let shortcutCallback: (() => void) | undefined;
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-shortcut-2', traceId: 'trace-2' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-shortcut-2' })
    });

    try {
      window.bubbles = {
        ...createBaseBubbles(),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn(() => () => undefined),
          onShortcutStart: vi.fn((callback) => {
            shortcutCallback = callback;
            return () => undefined;
          }),
          requestMicrophoneAccess: vi.fn().mockResolvedValue({ ok: true, status: 'granted' }),
          speak: vi.fn(),
          startSession,
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn(),
          transcribeAudio: vi.fn()
        }
      };

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: '',
          onTranscript: vi.fn()
        })
      );

      await waitFor(() => expect(shortcutCallback).toBeDefined());

      await act(async () => {
        shortcutCallback?.();
        shortcutCallback?.();
      });

      await waitFor(() => expect(media.recorders).toHaveLength(1));
      expect(startSession).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it('does not spend STT on a noise-only capture', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders({ detectSpeech: false });
    const transcribeAudio = vi.fn();
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-noise', traceId: 'trace-noise' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-noise' })
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
          latestBubbleText: '',
          onTranscript: vi.fn()
        })
      );

      await act(async () => {
        await result.current.startListening();
      });

      await act(async () => {
        media.recorders[0]?.emitData(new Blob(['noise'], { type: 'audio/webm' }));
        media.recorders[0]?.stop();
      });

      await waitFor(() => expect(result.current.voiceState.status).toBe('idle'));
      expect(transcribeAudio).not.toHaveBeenCalled();
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it.each([
    ['Hey Bubbles change your voice', 'change your voice'],
    ['Hi Bubbles change your voice', 'change your voice']
  ])('strips an intentional %s command prefix before submitting chat', async (transcript, expectedCommand) => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const onTranscript = vi.fn().mockResolvedValue(undefined);

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
          speak: vi.fn(),
          startSession: vi.fn(),
          stopSession: vi.fn(),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      };

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: '',
          onTranscript
        })
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-prefix', text: transcript },
          createVoiceState({ status: 'processing', captionText: transcript })
        );
      });

      await waitFor(() => expect(onTranscript).toHaveBeenCalledWith(expectedCommand));
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
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'Hey Bubbles approve', confidence: 0.92 },
          createVoiceState({ status: 'processing', captionText: 'Hey Bubbles approve' })
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

function mockMediaCaptureWithRecorders({ detectSpeech = true }: { detectSpeech?: boolean } = {}) {
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

  class FakeAudioContext {
    createAnalyser() {
      return {
        fftSize: 32,
        getFloatTimeDomainData(data: Float32Array) {
          data.fill(detectSpeech ? 0.05 : 0);
        }
      };
    }

    createMediaStreamSource() {
      return {
        connect: vi.fn(),
        disconnect: vi.fn()
      };
    }

    close = vi.fn().mockResolvedValue(undefined);
  }

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: detectSpeech ? undefined : FakeAudioContext
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
