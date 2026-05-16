import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { type VoiceEvent, type VoiceSessionState } from '@bubbles/core';

interface UseVoiceSessionOptions {
  chatEnabled: boolean;
  initialWakePhraseEnabled?: boolean;
  latestBubbleText: string;
  pendingApproval?: {
    id: string;
    title: string;
  };
  sideEffectsEnabled?: boolean;
  onApprovalResolved?: (message: string) => void;
  onTranscript: (text: string) => Promise<void> | void;
}

const WAKE_PHRASE = 'Hi Bubbles';

export function useVoiceSession({
  chatEnabled,
  initialWakePhraseEnabled = false,
  latestBubbleText,
  pendingApproval,
  sideEffectsEnabled = true,
  onApprovalResolved,
  onTranscript
}: UseVoiceSessionOptions) {
  const [voiceState, setVoiceState] = useState<VoiceSessionState>(() => createRendererVoiceState({ enabled: true }));
  const [voiceStateLoaded, setVoiceStateLoaded] = useState(false);
  const [wakePhraseEnabled, setWakePhraseEnabled] = useState(initialWakePhraseEnabled);
  const [wakeCycle, setWakeCycle] = useState(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const capturePurposeRef = useRef<'command' | 'wake'>('command');
  const shouldSpeakNextReplyRef = useRef(false);
  const currentTtsIdRef = useRef<string | undefined>(undefined);
  const lastSpokenTextRef = useRef('');
  const lastPromptedApprovalIdRef = useRef<string | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const vadCleanupRef = useRef<() => void>();
  const voiceEventReceivedRef = useRef(false);
  const chatEnabledRef = useRef(chatEnabled);
  const onApprovalResolvedRef = useRef(onApprovalResolved);
  const onTranscriptRef = useRef(onTranscript);
  const pendingApprovalRef = useRef(pendingApproval);
  const sideEffectsEnabledRef = useRef(sideEffectsEnabled);
  const speechDetectedRef = useRef(false);
  const wakePhraseEnabledRef = useRef(wakePhraseEnabled);
  const wakeRestartTimerRef = useRef<number | undefined>(undefined);
  const wakeStartInFlightRef = useRef(false);
  const wakeTurnIdsRef = useRef(new Set<string>());

  useEffect(() => {
    chatEnabledRef.current = chatEnabled;
    onApprovalResolvedRef.current = onApprovalResolved;
    onTranscriptRef.current = onTranscript;
    pendingApprovalRef.current = pendingApproval;
    sideEffectsEnabledRef.current = sideEffectsEnabled;
    wakePhraseEnabledRef.current = wakePhraseEnabled;
  }, [chatEnabled, onApprovalResolved, onTranscript, pendingApproval, sideEffectsEnabled, wakePhraseEnabled]);

  useEffect(() => {
    let ignore = false;

    const statePromise = window.bubbles?.voice?.getState();

    if (!statePromise) {
      setVoiceStateLoaded(true);
    } else {
      void statePromise
        .then((state) => {
          if (!ignore && !voiceEventReceivedRef.current) {
            setVoiceState(state);
          }
        })
        .finally(() => {
          if (!ignore) {
            setVoiceStateLoaded(true);
          }
        });
    }

    const unsubscribe = window.bubbles?.voice?.onEvent((event, state) => {
      voiceEventReceivedRef.current = true;
      const wakeFinal = event.type === 'voice.final' && wakeTurnIdsRef.current.has(event.voiceTurnId);

      if (wakeFinal) {
        return;
      }

      setVoiceState(state);

      if (!sideEffectsEnabledRef.current) {
        return;
      }

      if (event.type === 'voice.final' && event.text.trim()) {
        const activePendingApproval = pendingApprovalRef.current;

        if (activePendingApproval && window.bubbles?.voice?.resolveApproval) {
          void window.bubbles.voice
            .resolveApproval({
              approvalId: activePendingApproval.id,
              voiceTurnId: event.voiceTurnId,
              transcript: event.text
            })
            .then((result) => {
              onApprovalResolvedRef.current?.(result.message);
              setVoiceState((current) =>
                createRendererVoiceState({
                  ...current,
                  status: result.fallbackRequired ? 'idle' : 'speaking',
                  activeTurnId: result.fallbackRequired ? undefined : current.activeTurnId,
                  partialText: '',
                  captionText: result.message,
                  lastError: undefined
                })
              );
            });
          return;
        }

        shouldSpeakNextReplyRef.current = true;
        void onTranscriptRef.current(event.text);
      }
    });

    return () => {
      ignore = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearWakeRestartTimer(wakeRestartTimerRef);
      stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);
      stopActiveAudio(activeAudioRef);
    };
  }, []);

  useEffect(() => {
    if (!sideEffectsEnabled) {
      return;
    }

    if (!shouldSpeakNextReplyRef.current || !latestBubbleText.trim() || latestBubbleText === lastSpokenTextRef.current) {
      return;
    }

    shouldSpeakNextReplyRef.current = false;
    speak(latestBubbleText);
  }, [latestBubbleText, sideEffectsEnabled]);

  useEffect(() => {
    if (!sideEffectsEnabled) {
      return;
    }

    if (!chatEnabled || !pendingApproval || pendingApproval.id === lastPromptedApprovalIdRef.current) {
      return;
    }

    lastPromptedApprovalIdRef.current = pendingApproval.id;
    speak(`Approval needed: ${pendingApproval.title}. Say approve, deny, or cancel.`);
  }, [chatEnabled, pendingApproval, sideEffectsEnabled]);

  useEffect(() => {
    if (pendingApproval) {
      return;
    }

    lastPromptedApprovalIdRef.current = undefined;
    setVoiceState((current) => {
      if (!current.captionText.startsWith('Approval needed:')) {
        return current;
      }

      return createRendererVoiceState({ ...current, status: 'idle', captionText: '', partialText: '' });
    });
  }, [pendingApproval]);

  async function startWakeListening() {
    const voiceApi = window.bubbles?.voice;

    if (
      !chatEnabledRef.current ||
      !sideEffectsEnabledRef.current ||
      !wakePhraseEnabledRef.current ||
      wakeStartInFlightRef.current ||
      mediaRecorderRef.current ||
      !voiceApi?.startSession ||
      !voiceApi.transcribeAudio ||
      !canUseMicrophoneCapture()
    ) {
      return;
    }

    wakeStartInFlightRef.current = true;
    capturePurposeRef.current = 'wake';
    let voiceTurnId: string | undefined;

    try {
      const result = await voiceApi.startSession();
      voiceTurnId = result?.state.activeTurnId;

      if (voiceTurnId) {
        wakeTurnIdsRef.current.add(voiceTurnId);
      }

      if (result) {
        setVoiceState(
          createRendererVoiceState({
            ...result.state,
            mode: 'always-listening',
            captionText: `Say "${WAKE_PHRASE}"`
          })
        );
      }

      await startMicrophoneCapture(voiceTurnId, 'wake');
    } catch (error) {
      if (voiceTurnId) {
        wakeTurnIdsRef.current.delete(voiceTurnId);
      }
      stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);
      const message = error instanceof Error ? error.message : String(error);
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          status: 'error',
          lastError: message,
          captionText: message
        })
      );
      await window.bubbles?.voice?.stopSession();
    } finally {
      wakeStartInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (
      !sideEffectsEnabled ||
      !chatEnabled ||
      !wakePhraseEnabled ||
      !voiceStateLoaded ||
      !voiceState.enabled ||
      voiceState.status !== 'idle' ||
      mediaRecorderRef.current ||
      !canUseMicrophoneCapture()
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void startWakeListening();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [chatEnabled, sideEffectsEnabled, voiceState.enabled, voiceState.status, voiceStateLoaded, wakeCycle, wakePhraseEnabled]);

  const startListening = useCallback(async () => {
    if (!chatEnabled || !sideEffectsEnabled) {
      return;
    }

    clearWakeRestartTimer(wakeRestartTimerRef);
    capturePurposeRef.current = 'command';
    const result = await window.bubbles?.voice?.startSession();
    const voiceTurnId = result?.state.activeTurnId;

    if (result) {
      setVoiceState(result.state);
    }

    try {
      await startMicrophoneCapture(voiceTurnId);
    } catch (error) {
      stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);
      const message = error instanceof Error ? error.message : String(error);
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          status: 'error',
          lastError: message,
          captionText: message
        })
      );
      await window.bubbles?.voice?.stopSession();
    }
  }, [chatEnabled, sideEffectsEnabled]);

  const stopListening = useCallback(async () => {
    if (!sideEffectsEnabled) {
      return;
    }

    clearWakeRestartTimer(wakeRestartTimerRef);
    if (capturePurposeRef.current === 'wake') {
      wakePhraseEnabledRef.current = false;
      setWakePhraseEnabled(false);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }

    stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);
    const state = await window.bubbles?.voice?.stopSession();

    if (state) {
      setVoiceState(state);
      return;
    }

    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', activeTurnId: undefined }));
  }, [sideEffectsEnabled]);

  const bargeIn = useCallback(async () => {
    if (!sideEffectsEnabled) {
      return;
    }

    clearWakeRestartTimer(wakeRestartTimerRef);
    capturePurposeRef.current = 'command';
    stopActiveAudio(activeAudioRef);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    await window.bubbles?.voice?.stopSpeaking?.({ ttsId: currentTtsIdRef.current ?? 'tts-current' });
    const result = await window.bubbles?.voice?.bargeIn({ stoppedTtsId: currentTtsIdRef.current ?? 'tts-current' });

    if (result) {
      setVoiceState(result.state);
      return;
    }

    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'listening', captionText: '' }));
  }, [sideEffectsEnabled]);

  const toggleWakePhrase = useCallback(async () => {
    if (!sideEffectsEnabled) {
      return;
    }

    const enabled = !wakePhraseEnabledRef.current;
    wakePhraseEnabledRef.current = enabled;
    setWakePhraseEnabled(enabled);
    clearWakeRestartTimer(wakeRestartTimerRef);

    if (!enabled) {
      if (capturePurposeRef.current === 'wake' && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);
        await window.bubbles?.voice?.stopSession();
      }

      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          mode: 'push-to-talk',
          status: 'idle',
          activeTurnId: undefined,
          partialText: '',
          captionText: ''
        })
      );
      return;
    }

    setVoiceState((current) =>
      createRendererVoiceState({
        ...current,
        mode: 'always-listening',
        status: current.status === 'idle' ? 'idle' : current.status,
        captionText: current.status === 'idle' ? `Say "${WAKE_PHRASE}"` : current.captionText,
        lastError: undefined
      })
    );
    setWakeCycle((current) => current + 1);
  }, [sideEffectsEnabled]);

  function restartWakeListeningIfNeeded(delay = 350) {
    clearWakeRestartTimer(wakeRestartTimerRef);

    if (!chatEnabledRef.current || !sideEffectsEnabledRef.current || !wakePhraseEnabledRef.current) {
      return;
    }

    wakeRestartTimerRef.current = window.setTimeout(() => {
      setWakeCycle((current) => current + 1);
    }, delay);
  }

  async function startMicrophoneCapture(voiceTurnId: string | undefined, purpose: 'command' | 'wake' = 'command') {
    if (!canUseMicrophoneCapture()) {
      throw new Error('Live microphone capture is unavailable in this environment.');
    }

    const permission = await window.bubbles?.voice?.requestMicrophoneAccess?.();

    if (permission && !permission.ok) {
      throw new Error('Microphone access was denied. Allow Bubbles in system microphone settings.');
    }

    stopActiveAudio(activeAudioRef);
    stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = selectRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    capturePurposeRef.current = purpose;
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];
    speechDetectedRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    recorder.onerror = () => {
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          status: 'error',
          lastError: 'Microphone recording failed.',
          captionText: 'Microphone recording failed.'
        })
      );
    };
    recorder.onstop = () => {
      void finishMicrophoneCapture(voiceTurnId, recorder.mimeType || mimeType || 'audio/webm');
    };

    recorder.start();
    startVad(
      stream,
      () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      },
      () => {
        speechDetectedRef.current = true;
      },
      (cleanup) => {
        vadCleanupRef.current = cleanup;
      }
    );
  }

  async function finishMicrophoneCapture(voiceTurnId: string | undefined, recordedMimeType: string) {
    const chunks = audioChunksRef.current;
    const capturePurpose = capturePurposeRef.current;
    const heardSpeech = speechDetectedRef.current;
    speechDetectedRef.current = false;
    stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);

    if (!chunks.length || (capturePurpose === 'wake' && !heardSpeech)) {
      if (voiceTurnId) {
        wakeTurnIdsRef.current.delete(voiceTurnId);
      }
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          mode: capturePurpose === 'wake' ? 'always-listening' : current.mode,
          status: 'idle',
          captionText: capturePurpose === 'wake' ? `Say "${WAKE_PHRASE}"` : ''
        })
      );
      await window.bubbles?.voice?.stopSession();
      restartWakeListeningIfNeeded();
      return;
    }

    setVoiceState((current) =>
      createRendererVoiceState({
        ...current,
        status: 'processing',
        partialText: '',
        captionText: 'Transcribing voice...'
      })
    );

    try {
      const recordedBlob = new Blob(chunks, { type: recordedMimeType });
      const audioDataUrl = await audioBlobToWavDataUrl(recordedBlob);
      const result = await window.bubbles?.voice?.transcribeAudio?.({
        audioDataUrl,
        mimeType: 'audio/wav',
        voiceTurnId
      });

      if (capturePurpose === 'wake') {
        if (voiceTurnId) {
          wakeTurnIdsRef.current.delete(voiceTurnId);
        }

        if (!result) {
          throw new Error('Voice transcription is unavailable.');
        }

        if (!result.ok) {
          setVoiceState(result.state);
          if (result.retryable === false) {
            wakePhraseEnabledRef.current = false;
            setWakePhraseEnabled(false);
          } else {
            restartWakeListeningIfNeeded();
          }
          return;
        }

        await handleWakeTranscript(result.transcript);
        return;
      }

      if (result) {
        setVoiceState(result.state);
      } else {
        throw new Error('Voice transcription is unavailable.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          status: 'error',
          lastError: message,
          captionText: message
        })
      );
      if (capturePurpose === 'wake') {
        restartWakeListeningIfNeeded(1200);
      }
    }
  }

  async function handleWakeTranscript(transcript: string) {
    const wakeCommand = extractWakePhraseCommand(transcript);

    if (!wakeCommand.awake) {
      await window.bubbles?.voice?.stopSession();
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          mode: 'always-listening',
          status: 'idle',
          activeTurnId: undefined,
          partialText: '',
          captionText: `Say "${WAKE_PHRASE}"`
        })
      );
      restartWakeListeningIfNeeded();
      return;
    }

    if (!wakeCommand.commandText) {
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          mode: 'push-to-talk',
          status: 'listening',
          partialText: '',
          captionText: `${WAKE_PHRASE}. I am listening.`,
          lastError: undefined
        })
      );
      await startListening();
      return;
    }

    capturePurposeRef.current = 'command';
    shouldSpeakNextReplyRef.current = true;
    setVoiceState((current) =>
      createRendererVoiceState({
        ...current,
        mode: 'push-to-talk',
        status: 'processing',
        activeTurnId: undefined,
        partialText: '',
        captionText: wakeCommand.commandText,
        lastError: undefined
      })
    );
    await onTranscriptRef.current(wakeCommand.commandText);
  }

  function speak(text: string) {
    const ttsId = 'tts-current';
    currentTtsIdRef.current = ttsId;
    lastSpokenTextRef.current = text;
    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'speaking', captionText: text }));

    if (window.bubbles?.voice?.speak) {
      void window.bubbles.voice.speak({ text, ttsId }).then((result) => {
        if (!result?.ok || !result.audioUrl) {
          if (currentTtsIdRef.current === ttsId) {
            const errorMessage = result?.error ?? 'Voice playback failed.';
            currentTtsIdRef.current = undefined;
            setVoiceState((current) =>
              createRendererVoiceState({
                ...current,
                status: result?.ok ? 'idle' : 'error',
                lastError: result?.ok ? undefined : errorMessage,
                captionText: result?.ok ? current.captionText : errorMessage
              })
            );
          }
          return;
        }

        playAudioUrl(result.audioUrl, ttsId);
      });
      return;
    }

    currentTtsIdRef.current = undefined;
    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', lastError: undefined }));
  }

  function playAudioUrl(audioUrl: string, ttsId: string) {
    stopActiveAudio(activeAudioRef);

    if (typeof Audio !== 'function') {
      currentTtsIdRef.current = undefined;
      setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', lastError: undefined }));
      return;
    }

    const audio = new Audio(audioUrl);
    activeAudioRef.current = audio;
    audio.onended = () => {
      if (currentTtsIdRef.current === ttsId) {
        currentTtsIdRef.current = undefined;
        activeAudioRef.current = null;
        setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', lastError: undefined }));
      }
    };
    audio.onerror = () => {
      if (currentTtsIdRef.current === ttsId) {
        currentTtsIdRef.current = undefined;
        activeAudioRef.current = null;
        setVoiceState((current) =>
          createRendererVoiceState({
            ...current,
            status: 'error',
            lastError: 'Voice playback failed.',
            captionText: 'Voice playback failed.'
          })
        );
      }
    };
    void audio.play().catch(() => {
      if (currentTtsIdRef.current === ttsId) {
        currentTtsIdRef.current = undefined;
        activeAudioRef.current = null;
        setVoiceState((current) =>
          createRendererVoiceState({
            ...current,
            status: 'error',
            lastError: 'Audio playback was blocked.',
            captionText: 'Audio playback was blocked.'
          })
        );
      }
    });
  }

  return {
    toggleWakePhrase,
    voiceState,
    wakePhrase: WAKE_PHRASE,
    wakePhraseEnabled,
    startListening,
    stopListening,
    bargeIn
  };
}

export function isVoiceFinal(event: VoiceEvent): event is Extract<VoiceEvent, { type: 'voice.final' }> {
  return event.type === 'voice.final';
}

function createRendererVoiceState(overrides: Partial<VoiceSessionState> = {}): VoiceSessionState {
  return {
    enabled: false,
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

function selectRecorderMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function canUseMicrophoneCapture() {
  return (
    Boolean(navigator.mediaDevices) &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  );
}

function extractWakePhraseCommand(transcript: string): { awake: boolean; commandText: string } {
  const match = transcript.trim().match(/^hi[\s,]+bubbles\b[\s,.:;!?-]*(.*)$/i);

  if (!match) {
    return { awake: false, commandText: '' };
  }

  return { awake: true, commandText: (match[1] ?? '').trim() };
}

async function audioBlobToWavDataUrl(blob: Blob) {
  const AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return blobToDataUrl(blob);
  }

  const audioContext = new AudioContextCtor();

  try {
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));
    const wavView = wavDataViewFromAudioBuffer(audioBuffer);
    return blobToDataUrl(new Blob([wavView], { type: 'audio/wav' }));
  } finally {
    void audioContext.close();
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Audio encoding failed.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function wavDataViewFromAudioBuffer(audioBuffer: AudioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: channels }, (_unused, index) => audioBuffer.getChannelData(index));
  let offset = 44;

  for (let sample = 0; sample < samples; sample += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const clamped = Math.max(-1, Math.min(1, channelData[channel][sample] ?? 0));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return view;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function startVad(stream: MediaStream, stop: () => void, onSpeechDetected: () => void, setCleanup: (cleanup: () => void) => void) {
  const AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    onSpeechDetected();
    const timeout = window.setTimeout(stop, 15_000);
    setCleanup(() => window.clearTimeout(timeout));
    return;
  }

  const audioContext = new AudioContextCtor();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  const data = new Float32Array(analyser.fftSize);
  const startedAt = performance.now();
  let animationFrame = 0;
  let speechStartedAt = 0;
  let silenceStartedAt = 0;
  source.connect(analyser);

  function tick(now: number) {
    analyser.getFloatTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    const hasVoice = rms > 0.015;

    if (hasVoice && !speechStartedAt) {
      speechStartedAt = now;
      onSpeechDetected();
      silenceStartedAt = 0;
    } else if (speechStartedAt && !hasVoice) {
      silenceStartedAt ||= now;
    } else if (hasVoice) {
      silenceStartedAt = 0;
    }

    if (now - startedAt > 15_000 || (speechStartedAt && now - speechStartedAt > 500 && silenceStartedAt && now - silenceStartedAt > 800)) {
      stop();
      return;
    }

    animationFrame = window.requestAnimationFrame(tick);
  }

  animationFrame = window.requestAnimationFrame(tick);
  setCleanup(() => {
    window.cancelAnimationFrame(animationFrame);
    source.disconnect();
    void audioContext.close();
  });
}

function stopCaptureResources(
  vadCleanupRef: MutableRefObject<(() => void) | undefined>,
  mediaRecorderRef: MutableRefObject<MediaRecorder | null>,
  mediaStreamRef: MutableRefObject<MediaStream | null>
) {
  vadCleanupRef.current?.();
  vadCleanupRef.current = undefined;
  mediaRecorderRef.current = null;
  mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  mediaStreamRef.current = null;
}

function clearWakeRestartTimer(wakeRestartTimerRef: MutableRefObject<number | undefined>) {
  if (wakeRestartTimerRef.current === undefined) {
    return;
  }

  window.clearTimeout(wakeRestartTimerRef.current);
  wakeRestartTimerRef.current = undefined;
}

function stopActiveAudio(activeAudioRef: MutableRefObject<HTMLAudioElement | null>) {
  if (!activeAudioRef.current) {
    return;
  }

  activeAudioRef.current.pause();
  activeAudioRef.current.src = '';
  activeAudioRef.current = null;
}
