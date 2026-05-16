import { useCallback, useEffect, useRef, useState } from 'react';
import { type VoiceEvent, type VoiceSessionState } from '@bubbles/core';

interface UseVoiceSessionOptions {
  chatEnabled: boolean;
  latestBubbleText: string;
  pendingApproval?: {
    id: string;
    title: string;
  };
  onApprovalResolved?: (message: string) => void;
  onTranscript: (text: string) => Promise<void> | void;
}

export function useVoiceSession({
  chatEnabled,
  latestBubbleText,
  pendingApproval,
  onApprovalResolved,
  onTranscript
}: UseVoiceSessionOptions) {
  const [voiceState, setVoiceState] = useState<VoiceSessionState>(() => createRendererVoiceState({ enabled: true }));
  const shouldSpeakNextReplyRef = useRef(false);
  const currentTtsIdRef = useRef<string | undefined>(undefined);
  const lastSpokenTextRef = useRef('');
  const lastPromptedApprovalIdRef = useRef<string | undefined>(undefined);
  const voiceEventReceivedRef = useRef(false);
  const chatEnabledRef = useRef(chatEnabled);
  const onApprovalResolvedRef = useRef(onApprovalResolved);
  const onTranscriptRef = useRef(onTranscript);
  const pendingApprovalRef = useRef(pendingApproval);

  useEffect(() => {
    chatEnabledRef.current = chatEnabled;
    onApprovalResolvedRef.current = onApprovalResolved;
    onTranscriptRef.current = onTranscript;
    pendingApprovalRef.current = pendingApproval;
  }, [chatEnabled, onApprovalResolved, onTranscript, pendingApproval]);

  useEffect(() => {
    let ignore = false;

    void window.bubbles?.voice?.getState().then((state) => {
      if (!ignore && !voiceEventReceivedRef.current) {
        setVoiceState(state);
      }
    });

    const unsubscribe = window.bubbles?.voice?.onEvent((event, state) => {
      voiceEventReceivedRef.current = true;
      setVoiceState(state);

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
    if (!shouldSpeakNextReplyRef.current || !latestBubbleText.trim() || latestBubbleText === lastSpokenTextRef.current) {
      return;
    }

    shouldSpeakNextReplyRef.current = false;
    speak(latestBubbleText);
  }, [latestBubbleText]);

  useEffect(() => {
    if (!chatEnabled || !pendingApproval || pendingApproval.id === lastPromptedApprovalIdRef.current) {
      return;
    }

    lastPromptedApprovalIdRef.current = pendingApproval.id;
    speak(`Approval needed: ${pendingApproval.title}. Say approve, deny, or cancel.`);
  }, [chatEnabled, pendingApproval]);

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

  const startListening = useCallback(async () => {
    if (!chatEnabled) {
      return;
    }

    const result = await window.bubbles?.voice?.startSession();

    if (result) {
      setVoiceState(result.state);
      return;
    }

    setVoiceState(createRendererVoiceState({ enabled: true, status: 'listening' }));
  }, [chatEnabled]);

  const stopListening = useCallback(async () => {
    const state = await window.bubbles?.voice?.stopSession();

    if (state) {
      setVoiceState(state);
      return;
    }

    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', activeTurnId: undefined }));
  }, []);

  const bargeIn = useCallback(async () => {
    window.speechSynthesis?.cancel();
    await window.bubbles?.voice?.stopSpeaking?.({ ttsId: currentTtsIdRef.current ?? 'tts-current' });
    const result = await window.bubbles?.voice?.bargeIn({ stoppedTtsId: currentTtsIdRef.current ?? 'tts-current' });

    if (result) {
      setVoiceState(result.state);
      return;
    }

    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'listening', captionText: '' }));
  }, []);

  function speak(text: string) {
    const ttsId = 'tts-current';
    currentTtsIdRef.current = ttsId;
    lastSpokenTextRef.current = text;
    setVoiceState((current) => createRendererVoiceState({ ...current, status: 'speaking', captionText: text }));

    if (window.bubbles?.voice?.speak) {
      void window.bubbles.voice.speak({ text, ttsId }).then(() => {
        if (currentTtsIdRef.current === ttsId) {
          currentTtsIdRef.current = undefined;
          setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', lastError: undefined }));
        }
      });
      return;
    }

    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      currentTtsIdRef.current = undefined;
      setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle', lastError: undefined }));
      return;
    }

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      currentTtsIdRef.current = undefined;
      setVoiceState((current) => createRendererVoiceState({ ...current, status: 'idle' }));
    };
    utterance.onerror = () => {
      currentTtsIdRef.current = undefined;
      setVoiceState((current) =>
        createRendererVoiceState({
          ...current,
          status: 'idle',
          lastError: undefined
        })
      );
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
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
    provider: 'native-macos',
    status: 'idle',
    activeTurnId: undefined,
    partialText: '',
    captionText: '',
    lastError: undefined,
    ...overrides
  };
}
