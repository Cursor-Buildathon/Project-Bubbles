import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { type VoiceEvent, type VoiceSessionState } from '@bubbles/core';
import { prepareSpokenResponse } from '@bubbles/core/src/voice/spokenResponsePolicy.js';

export interface VoiceReplyCandidate {
  artifactIds?: string[];
  id?: number;
  speakOnArrival?: boolean;
  text: string;
  voiceText?: string;
}

interface UseVoiceSessionOptions {
  latestBubbleArtifactIds?: string[];
  chatEnabled: boolean;
  latestBubbleMessageId?: number;
  latestBubbleSpeakOnArrival?: boolean;
  latestBubbleText: string;
  pendingApproval?: {
    id: string;
    title: string;
  };
  sideEffectsEnabled?: boolean;
  onApprovalResolved?: (message: string) => void;
  onTranscript: (text: string) => Promise<VoiceReplyCandidate | void> | VoiceReplyCandidate | void;
}

const COMMAND_PREFIX_LABEL = 'Hey Bubbles';
const SPOKEN_ARRIVAL_STORAGE_KEY = 'bubbles:voice:spoken-arrivals';
const MAX_STORED_SPOKEN_ARRIVALS = 80;
const MIN_FALLBACK_AUDIO_BYTES = 512;

export function useVoiceSession({
  chatEnabled,
  latestBubbleArtifactIds = [],
  latestBubbleMessageId,
  latestBubbleSpeakOnArrival = false,
  latestBubbleText,
  pendingApproval,
  sideEffectsEnabled = true,
  onApprovalResolved,
  onTranscript
}: UseVoiceSessionOptions) {
  const [voiceState, setVoiceState] = useState<VoiceSessionState>(() => createRendererVoiceState({ enabled: true }));
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const captureStartInFlightRef = useRef(false);
  const currentTtsIdRef = useRef<string | undefined>(undefined);
  const handledFinalTranscriptKeysRef = useRef(new Set<string>());
  const lastSpokenTextRef = useRef('');
  const pendingVoiceReplyTokenRef = useRef<string | undefined>(undefined);
  const voiceReplySequenceRef = useRef(0);
  const speechRequestTokenRef = useRef(0);
  const spokenArrivalKeysRef = useRef<Set<string>>(loadSpokenArrivalKeys());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const vadCleanupRef = useRef<() => void>();
  const voiceEventReceivedRef = useRef(false);
  const onApprovalResolvedRef = useRef(onApprovalResolved);
  const onTranscriptRef = useRef(onTranscript);
  const pendingApprovalRef = useRef(pendingApproval);
  const sideEffectsEnabledRef = useRef(sideEffectsEnabled);
  const speechDetectedRef = useRef(false);
  const voiceStateRef = useRef(voiceState);

  useEffect(() => {
    onApprovalResolvedRef.current = onApprovalResolved;
    onTranscriptRef.current = onTranscript;
    pendingApprovalRef.current = pendingApproval;
    sideEffectsEnabledRef.current = sideEffectsEnabled;
  }, [onApprovalResolved, onTranscript, pendingApproval, sideEffectsEnabled]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    let ignore = false;

    const statePromise = window.bubbles?.voice?.getState();

    if (statePromise) {
      void statePromise
        .then((state) => {
          if (!ignore && !voiceEventReceivedRef.current) {
            setVoiceState(state);
          }
        });
    }

    const unsubscribe = window.bubbles?.voice?.onEvent((event, state) => {
      voiceEventReceivedRef.current = true;

      voiceStateRef.current = state;
      setVoiceState(state);

      if (!sideEffectsEnabledRef.current) {
        return;
      }

      if (event.type === 'voice.final' && event.text.trim()) {
        void handleFinalTranscriptOnce(event);
      }
    });

    return () => {
      ignore = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);
      stopActiveAudio(activeAudioRef);
    };
  }, []);

  useEffect(() => {
    if (!sideEffectsEnabled) {
      return;
    }

    if (!latestBubbleSpeakOnArrival || latestBubbleMessageId === undefined) {
      return;
    }

    const text = latestBubbleText.trim();
    const speechKey = createSpokenArrivalKey({
      artifactIds: latestBubbleArtifactIds,
      messageId: latestBubbleMessageId,
      text
    });

    if (!text || spokenArrivalKeysRef.current.has(speechKey)) {
      return;
    }

    rememberSpokenArrivalKey(spokenArrivalKeysRef.current, speechKey);
    speak(text, speechKey);
  }, [latestBubbleArtifactIds, latestBubbleMessageId, latestBubbleSpeakOnArrival, latestBubbleText, sideEffectsEnabled]);

  const startListening = useCallback(async (force = false) => {
    const voiceApi = window.bubbles?.voice;
    const currentStatus = voiceStateRef.current.status;

    if (
      !chatEnabled ||
      !sideEffectsEnabled ||
      (!force && (currentStatus === 'listening' || currentStatus === 'processing')) ||
      mediaRecorderRef.current ||
      captureStartInFlightRef.current ||
      !voiceApi?.startSession ||
      !canUseMicrophoneCapture()
    ) {
      return;
    }

    captureStartInFlightRef.current = true;
    let voiceTurnId: string | undefined;

    try {
      let result;

      if (currentStatus === 'speaking') {
        const stoppedTtsId = currentTtsIdRef.current ?? 'tts-current';
        cancelPendingSpeech();
        stopActiveAudio(activeAudioRef);
        await voiceApi.stopSpeaking?.({ ttsId: stoppedTtsId });
        result = await voiceApi.bargeIn?.({ stoppedTtsId });
      } else {
        result = await voiceApi.startSession();
      }

      voiceTurnId = result?.state.activeTurnId;

      if (result) {
        setVoiceState(result.state);
      }

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
    } finally {
      captureStartInFlightRef.current = false;
    }
  }, [chatEnabled, sideEffectsEnabled]);

  useEffect(() => {
    if (!sideEffectsEnabled) {
      return;
    }

    return window.bubbles?.voice?.onShortcutStart?.(() => {
      void startListening();
    });
  }, [sideEffectsEnabled, startListening]);

  const stopListening = useCallback(async () => {
    if (!sideEffectsEnabled) {
      return;
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

    const stoppedTtsId = currentTtsIdRef.current ?? 'tts-current';
    cancelPendingSpeech();
    stopActiveAudio(activeAudioRef);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    await window.bubbles?.voice?.stopSpeaking?.({ ttsId: stoppedTtsId });
    const result = await window.bubbles?.voice?.bargeIn({ stoppedTtsId });

    if (result) {
      setVoiceState(result.state);
      return;
    }

    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'listening', captionText: '' }));
  }, [sideEffectsEnabled]);

  async function startMicrophoneCapture(voiceTurnId: string | undefined) {
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
    const heardSpeech = speechDetectedRef.current;
    speechDetectedRef.current = false;
    stopCaptureResources(vadCleanupRef, mediaRecorderRef, mediaStreamRef);

    if (!shouldTranscribeCapture(chunks, heardSpeech)) {
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          status: 'idle',
          captionText: ''
        })
      );
      await window.bubbles?.voice?.stopSession();
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
      const audioPayload = await audioBlobToTranscriptionPayload(recordedBlob);
      const result = await window.bubbles?.voice?.transcribeAudio?.({
        audioDataUrl: audioPayload.audioDataUrl,
        mimeType: audioPayload.mimeType,
        voiceTurnId
      });

      if (result) {
        voiceStateRef.current = result.state;
        setVoiceState(result.state);
        if (result.ok && isVoiceFinal(result.event)) {
          await handleFinalTranscriptOnce(result.event);
        }
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
    }
  }

  async function handleFinalTranscriptOnce(event: Extract<VoiceEvent, { type: 'voice.final' }>) {
    const transcriptKey = `${event.voiceTurnId}:${event.text.trim()}`;

    if (handledFinalTranscriptKeysRef.current.has(transcriptKey)) {
      return;
    }

    handledFinalTranscriptKeysRef.current.add(transcriptKey);
    await handleFinalTranscript(event);
  }

  async function handleFinalTranscript(event: Extract<VoiceEvent, { type: 'voice.final' }>) {
    const normalized = normalizeCommandTranscript(event.text);
    const isWakeOnlyTranscript = normalized.hadWakePhrase && !normalized.commandText;

    if (isWakeOnlyTranscript && voiceStateRef.current.mode === 'always-listening') {
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          mode: 'push-to-talk',
          status: 'listening',
          partialText: '',
          captionText: `${COMMAND_PREFIX_LABEL}. I am listening.`,
          lastError: undefined
        })
      );
      await startListening(true);
      return;
    }

    const transcript = isWakeOnlyTranscript ? event.text.trim() : normalized.commandText || event.text.trim();

    if (!transcript) {
      return;
    }

    if (transcript !== event.text.trim()) {
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          partialText: '',
          captionText: transcript,
          lastError: undefined
        })
      );
    }

    const activePendingApproval = pendingApprovalRef.current;

    if (activePendingApproval && window.bubbles?.voice?.resolveApproval) {
      void window.bubbles.voice
        .resolveApproval({
          approvalId: activePendingApproval.id,
          voiceTurnId: event.voiceTurnId,
          transcript
        })
        .then((result) => {
          onApprovalResolvedRef.current?.(result.message);
          const shouldSpeakClarification = result.decision.decision === 'unclear' && !result.fallbackRequired;

          if (shouldSpeakClarification && window.bubbles?.voice?.speak) {
            speak(result.message, `approval:${activePendingApproval.id}:${result.attemptCount}:${result.message}`);
            return;
          }

          setVoiceState((current) =>
            createRendererVoiceState({
              ...current,
              status: 'idle',
              activeTurnId: undefined,
              partialText: '',
              captionText: result.message,
              lastError: undefined
            })
          );
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Voice approval failed.';
          setVoiceState((current) =>
            createRendererVoiceState({
              ...current,
              status: 'error',
              activeTurnId: undefined,
              partialText: '',
              captionText: message,
              lastError: message
            })
          );
        });
      return;
    }

    const replyToken = createVoiceReplyToken(event.voiceTurnId, voiceReplySequenceRef);
    pendingVoiceReplyTokenRef.current = replyToken;

    try {
      const reply = await onTranscriptRef.current(transcript);

      if (pendingVoiceReplyTokenRef.current !== replyToken) {
        return;
      }

      pendingVoiceReplyTokenRef.current = undefined;
      speakVoiceReply(reply);
    } catch (error) {
      if (pendingVoiceReplyTokenRef.current !== replyToken) {
        return;
      }

      pendingVoiceReplyTokenRef.current = undefined;
      const message = error instanceof Error ? error.message : 'Voice request failed.';
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          status: 'error',
          activeTurnId: undefined,
          partialText: '',
          captionText: message,
          lastError: message
        })
      );
    }
  }

  function speakVoiceReply(reply: VoiceReplyCandidate | void) {
    if (!reply) {
      return;
    }

    const text = (reply.voiceText ?? reply.text).trim();

    if (!text) {
      return;
    }

    const speechKey =
      reply.speakOnArrival && reply.id !== undefined
        ? createSpokenArrivalKey({
            artifactIds: reply.artifactIds ?? [],
            messageId: reply.id,
            text
          })
        : undefined;

    if (speechKey) {
      rememberSpokenArrivalKey(spokenArrivalKeysRef.current, speechKey);
      speak(text, speechKey);
      return;
    }

    const spoken = prepareSpokenResponse({ chatText: reply.text, summary: text });
    speak(spoken.voiceText, reply.text);
  }

  function speak(text: string, dedupeText = text) {
    const ttsId = 'tts-current';
    const requestToken = speechRequestTokenRef.current + 1;
    speechRequestTokenRef.current = requestToken;
    currentTtsIdRef.current = ttsId;
    lastSpokenTextRef.current = dedupeText;
    stopActiveAudio(activeAudioRef);
    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'speaking', captionText: text }));

    if (window.bubbles?.voice?.speak) {
      void window.bubbles.voice.speak({ text, ttsId }).then((result) => {
        if (speechRequestTokenRef.current !== requestToken || currentTtsIdRef.current !== ttsId) {
          return;
        }

        if (!result?.ok || !result.audioUrl) {
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
          return;
        }

        playAudioUrl(result.audioUrl, ttsId, requestToken);
      });
      return;
    }

    currentTtsIdRef.current = undefined;
    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', lastError: undefined }));
  }

  function cancelPendingSpeech() {
    speechRequestTokenRef.current += 1;
    currentTtsIdRef.current = undefined;
    pendingVoiceReplyTokenRef.current = undefined;
  }

  function playAudioUrl(audioUrl: string, ttsId: string, requestToken: number) {
    if (speechRequestTokenRef.current !== requestToken || currentTtsIdRef.current !== ttsId) {
      return;
    }

    stopActiveAudio(activeAudioRef);

    if (typeof Audio !== 'function') {
      currentTtsIdRef.current = undefined;
      setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', lastError: undefined }));
      return;
    }

    const audio = new Audio(audioUrl);
    activeAudioRef.current = audio;
    audio.onended = () => {
      if (speechRequestTokenRef.current === requestToken && currentTtsIdRef.current === ttsId) {
        currentTtsIdRef.current = undefined;
        activeAudioRef.current = null;
        setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', lastError: undefined }));
      }
    };
    audio.onerror = () => {
      if (speechRequestTokenRef.current === requestToken && currentTtsIdRef.current === ttsId) {
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
      if (speechRequestTokenRef.current === requestToken && currentTtsIdRef.current === ttsId) {
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
    voiceState,
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

function shouldTranscribeCapture(chunks: Blob[], heardSpeech: boolean) {
  const capturedBytes = chunks.reduce((total, chunk) => total + chunk.size, 0);
  return chunks.some((chunk) => chunk.size > 0) && (heardSpeech || capturedBytes >= MIN_FALLBACK_AUDIO_BYTES);
}

function normalizeCommandTranscript(transcript: string): { commandText: string; hadWakePhrase: boolean } {
  const match = transcript.trim().match(/^(?:hey|hi)[\s,]+bubbles\b[\s,.:;!?-]*(.*)$/i);

  if (!match) {
    return { commandText: transcript.trim(), hadWakePhrase: false };
  }

  return { commandText: (match[1] ?? '').trim(), hadWakePhrase: true };
}

function createVoiceReplyToken(voiceTurnId: string, sequenceRef: MutableRefObject<number>) {
  sequenceRef.current += 1;
  return `${voiceTurnId}:${sequenceRef.current}`;
}

async function audioBlobToTranscriptionPayload(blob: Blob) {
  try {
    return {
      audioDataUrl: await audioBlobToWavDataUrl(blob),
      mimeType: 'audio/wav'
    };
  } catch {
    return {
      audioDataUrl: await blobToDataUrl(blob),
      mimeType: blob.type || 'audio/webm'
    };
  }
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

function stopActiveAudio(activeAudioRef: MutableRefObject<HTMLAudioElement | null>) {
  if (!activeAudioRef.current) {
    return;
  }

  activeAudioRef.current.pause();
  activeAudioRef.current.src = '';
  activeAudioRef.current = null;
}

function createSpokenArrivalKey({
  artifactIds,
  messageId,
  text
}: {
  artifactIds: string[];
  messageId: number;
  text: string;
}) {
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  const normalizedArtifacts = artifactIds.map((id) => id.trim()).filter(Boolean).sort().join(',');
  return `${messageId}:${normalizedText}:${normalizedArtifacts}`;
}

function loadSpokenArrivalKeys() {
  try {
    const raw = window.sessionStorage?.getItem(SPOKEN_ARRIVAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function rememberSpokenArrivalKey(keys: Set<string>, key: string) {
  keys.add(key);

  while (keys.size > MAX_STORED_SPOKEN_ARRIVALS) {
    const oldest = keys.values().next().value;

    if (!oldest) {
      break;
    }

    keys.delete(oldest);
  }

  try {
    window.sessionStorage?.setItem(SPOKEN_ARRIVAL_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Session storage is only a remount guard; in-memory dedupe still covers the active hook.
  }
}
