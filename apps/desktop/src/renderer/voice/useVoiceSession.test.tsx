import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { type VoiceEvent, type VoiceSessionState } from '@bubbles/core';
import { useVoiceSession } from './useVoiceSession';

const chatPanelPrompt = 'Please look in the chat panel for the response.';
let recordedMockAudioSources: string[] = [];

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
    const onTranscript = vi.fn().mockResolvedValue({ id: 2, text: 'Short MiniMax reply.' });
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

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: '',
          onTranscript
        })
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'Hello Bubbles.' },
          createVoiceState({ status: 'processing', captionText: 'Hello Bubbles.' })
        );
      });

      await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Hello Bubbles.'));
      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'Short MiniMax reply.', ttsId: 'tts-current' }));
    } finally {
      window.bubbles = previousBubbles;
      restoreAudio();
    }
  });

  it('speaks only the newest voice reply when an older response resolves late', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const olderReply = createDeferred<{ id: number; text: string }>();
    const newerReply = createDeferred<{ id: number; text: string }>();
    const onTranscript = vi.fn((text: string) => (text === 'older request' ? olderReply.promise : newerReply.promise));
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

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: '',
          onTranscript
        })
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-old', text: 'older request' },
          createVoiceState({ status: 'processing', captionText: 'older request' })
        );
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-new', text: 'newer request' },
          createVoiceState({ status: 'processing', captionText: 'newer request' })
        );
      });

      newerReply.resolve({ id: 4, text: 'Newer reply.' });
      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'Newer reply.', ttsId: 'tts-current' }));

      olderReply.resolve({ id: 2, text: 'Older reply.' });
      await act(async () => {
        await Promise.resolve();
      });

      expect(speak).not.toHaveBeenCalledWith({ text: 'Older reply.', ttsId: 'tts-current' });
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('does not replay a completed arrival message after the voice hook remounts', async () => {
    const previousBubbles = window.bubbles;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });
    window.sessionStorage.clear();

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

      const props = {
        latestBubbleArtifactIds: ['image-asset-1'],
        latestBubbleMessageId: 42,
        latestBubbleSpeakOnArrival: true,
        latestBubbleText: 'The image is ready.'
      };
      const firstRender = renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          ...props,
          onTranscript: vi.fn()
        })
      );

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'The image is ready.', ttsId: 'tts-current' }));
      firstRender.unmount();

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          ...props,
          onTranscript: vi.fn()
        })
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
      window.sessionStorage.clear();
    }
  });

  it('ignores stale MiniMax audio when a newer speech request has started', async () => {
    const previousBubbles = window.bubbles;
    const restoreAudio = mockAudioPlayback();
    const firstSpeech = createDeferred<{ ok: true; ttsId: string; audioUrl: string }>();
    const secondSpeech = createDeferred<{ ok: true; ttsId: string; audioUrl: string }>();
    const speak = vi.fn().mockReturnValueOnce(firstSpeech.promise).mockReturnValueOnce(secondSpeech.promise);
    window.sessionStorage.clear();

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
        ({ latestBubbleMessageId, latestBubbleText }) =>
          useVoiceSession({
            chatEnabled: true,
            latestBubbleMessageId,
            latestBubbleSpeakOnArrival: true,
            latestBubbleText,
            onTranscript: vi.fn()
          }),
        { initialProps: { latestBubbleMessageId: 50, latestBubbleText: 'The image is ready.' } }
      );

      await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
      rerender({ latestBubbleMessageId: 51, latestBubbleText: 'The music is ready.' });
      await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));

      secondSpeech.resolve({ ok: true, ttsId: 'tts-current', audioUrl: 'bubbles-artifact://local/second.mp3' });
      await waitFor(() => expect(mockAudioSources()).toEqual(['bubbles-artifact://local/second.mp3']));

      firstSpeech.resolve({ ok: true, ttsId: 'tts-current', audioUrl: 'bubbles-artifact://local/first.mp3' });
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockAudioSources()).toEqual(['bubbles-artifact://local/second.mp3']);
    } finally {
      window.bubbles = previousBubbles;
      window.sessionStorage.clear();
      restoreAudio();
    }
  });

  it.each([
    ['image-generation', 'The image is ready.'],
    ['music-generation', 'The music is ready.']
  ])('speaks flagged %s messages once even when the request was typed', async (_label, readyText) => {
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
        latestBubbleText: readyText
      });
      rerender({
        latestBubbleMessageId: 2,
        latestBubbleSpeakOnArrival: true,
        latestBubbleText: readyText
      });

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: readyText, ttsId: 'tts-current' }));
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('speaks a voice-triggered speak-on-arrival reply once without replaying on state arrival', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });
    const onTranscript = vi.fn().mockResolvedValue({
      artifactIds: ['image-voice-1'],
      id: 12,
      speakOnArrival: true,
      text: 'The image is ready. You can download it from the chat window.',
      voiceText: 'The image is ready.'
    });
    window.sessionStorage.clear();

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
        ({ latestBubbleArtifactIds, latestBubbleMessageId, latestBubbleSpeakOnArrival, latestBubbleText }) =>
          useVoiceSession({
            chatEnabled: true,
            latestBubbleArtifactIds,
            latestBubbleMessageId,
            latestBubbleSpeakOnArrival,
            latestBubbleText,
            onTranscript
          }),
        {
          initialProps: {
            latestBubbleArtifactIds: [] as string[],
            latestBubbleMessageId: undefined as number | undefined,
            latestBubbleSpeakOnArrival: false,
            latestBubbleText: ''
          }
        }
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-image', text: 'make an image' },
          createVoiceState({ status: 'processing', captionText: 'make an image' })
        );
      });

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'The image is ready.', ttsId: 'tts-current' }));

      rerender({
        latestBubbleArtifactIds: ['image-voice-1'],
        latestBubbleMessageId: 12,
        latestBubbleSpeakOnArrival: true,
        latestBubbleText: 'The image is ready.'
      });

      await act(async () => {
        await Promise.resolve();
      });
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
      window.sessionStorage.clear();
    }
  });

  it('speaks a completed typed video-generation message once when it replaces the working message', async () => {
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
        {
          initialProps: {
            latestBubbleMessageId: 8,
            latestBubbleSpeakOnArrival: false,
            latestBubbleText: "I'm generating your video. This can take a few minutes."
          }
        }
      );

      rerender({
        latestBubbleMessageId: 8,
        latestBubbleSpeakOnArrival: true,
        latestBubbleText: 'The video is ready.'
      });
      rerender({
        latestBubbleMessageId: 8,
        latestBubbleSpeakOnArrival: true,
        latestBubbleText: 'The video is ready.'
      });

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'The video is ready.', ttsId: 'tts-current' }));
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('asks the user to look in chat instead of speaking long assistant replies', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });
    const longReply = [
      'I finished the task and put a complete explanation with next steps in the chat panel.',
      'The full write-up includes what changed, what I checked, and the remaining caveats so the spoken response can stay compact.',
      'Please use the chat panel for the details because this response is intentionally over the TTS character limit.',
      'This extra sentence keeps the fixture above the current spoken response threshold without changing the behavior under test.',
      'The fixture also remains long enough when the threshold increases, so the hook continues proving it speaks the chat-panel prompt.'
    ].join(' ');
    const onTranscript = vi.fn().mockResolvedValue({ id: 2, text: longReply });

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

      renderHook(() =>
        useVoiceSession({
          chatEnabled: true,
          latestBubbleText: '',
          onTranscript
        })
      );

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'Hello Bubbles.' },
          createVoiceState({ status: 'processing', captionText: 'Hello Bubbles.' })
        );
      });

      await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Hello Bubbles.'));
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

  it('submits meaningful captured audio even when VAD misses speech', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders({ detectSpeech: false });
    const onTranscript = vi.fn().mockResolvedValue(undefined);
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-vad-miss', traceId: 'trace-vad-miss' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-vad-miss' })
    });
    const transcribeAudio = vi.fn().mockResolvedValue({
      ok: true,
      event: { type: 'voice.final', voiceTurnId: 'voice-vad-miss', text: 'Open the planner.' },
      provider: 'gemini',
      state: createVoiceState({ status: 'processing', activeTurnId: 'voice-vad-miss', captionText: 'Open the planner.' }),
      transcript: 'Open the planner.'
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
          onTranscript
        })
      );

      await act(async () => {
        await result.current.startListening();
      });

      await act(async () => {
        media.recorders[0]?.emitData(new Blob(['x'.repeat(768)], { type: 'audio/webm' }));
        media.recorders[0]?.stop();
      });

      await waitFor(() => expect(transcribeAudio).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Open the planner.'));
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it('falls back to the recorded MIME payload when WAV conversion fails', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders({ breakDecode: true });
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-webm', traceId: 'trace-webm' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-webm' })
    });
    const transcribeAudio = vi.fn().mockResolvedValue({
      ok: true,
      event: { type: 'voice.final', voiceTurnId: 'voice-webm', text: 'Capture this.' },
      provider: 'gemini',
      state: createVoiceState({ status: 'processing', activeTurnId: 'voice-webm', captionText: 'Capture this.' }),
      transcript: 'Capture this.'
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
        media.recorders[0]?.emitData(new Blob(['x'.repeat(768)], { type: 'audio/webm' }));
        media.recorders[0]?.stop();
      });

      await waitFor(() =>
        expect(transcribeAudio).toHaveBeenCalledWith(
          expect.objectContaining({
            audioDataUrl: expect.stringMatching(/^data:audio\/webm/),
            mimeType: 'audio/webm'
          })
        )
      );
    } finally {
      window.bubbles = previousBubbles;
      media.restore();
    }
  });

  it('submits the returned STT transcript when no voice final broadcast arrives', async () => {
    const previousBubbles = window.bubbles;
    const media = mockMediaCaptureWithRecorders();
    const onTranscript = vi.fn().mockResolvedValue(undefined);
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-stt', traceId: 'trace-stt' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-stt' })
    });
    const transcribeAudio = vi.fn().mockResolvedValue({
      ok: true,
      event: { type: 'voice.final', voiceTurnId: 'voice-stt', text: 'Hi, Bubbles.' },
      provider: 'gemini',
      state: createVoiceState({ status: 'processing', activeTurnId: 'voice-stt', captionText: 'Hi, Bubbles.' }),
      transcript: 'Hi, Bubbles.'
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
          onTranscript
        })
      );

      await act(async () => {
        await result.current.startListening();
      });

      await act(async () => {
        media.recorders[0]?.emitData(new Blob(['speech'], { type: 'audio/webm' }));
        media.recorders[0]?.stop();
      });

      await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Hi, Bubbles.'));
      expect(transcribeAudio).toHaveBeenCalledTimes(1);
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
      expect(result.current.voiceState.status).toBe('idle');
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

  it('does not speak approval prompts when an approval becomes pending', async () => {
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

      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        rerender({ pendingApproval: { id: 'approval-1', title: 'Send email' } });
        rerender({ pendingApproval: { id: 'approval-1', title: 'Send email' } });
      });

      expect(speak).not.toHaveBeenCalled();
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
  recordedMockAudioSources = [];
  class FakeAudio {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';

    constructor(src: string) {
      this.src = src;
      recordedMockAudioSources.push(src);
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

function mockAudioSources() {
  return recordedMockAudioSources;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function mockMediaCaptureWithRecorders({ breakDecode = false, detectSpeech = true }: { breakDecode?: boolean; detectSpeech?: boolean } = {}) {
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

    decodeAudioData = breakDecode ? vi.fn().mockRejectedValue(new Error('decode failed')) : undefined;
    close = vi.fn().mockResolvedValue(undefined);
  }

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: detectSpeech && !breakDecode ? undefined : FakeAudioContext
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
