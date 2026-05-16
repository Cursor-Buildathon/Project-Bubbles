import { Mic, MicOff, VolumeX } from 'lucide-react';
import { type VoiceSessionState } from '@bubbles/core';
import { CaptionBar } from './CaptionBar';

interface VoiceControlsProps {
  chatEnabled: boolean;
  onBargeIn: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  voiceState: VoiceSessionState;
}

export function VoiceControls({
  chatEnabled,
  onBargeIn,
  onStartListening,
  onStopListening,
  voiceState
}: VoiceControlsProps) {
  const listening = voiceState.status === 'listening' || voiceState.status === 'processing';
  const speaking = voiceState.status === 'speaking';
  const captionText = voiceState.partialText || voiceState.captionText;
  const buttonLabel = speaking ? 'Barge in' : listening ? 'Stop voice input' : 'Start voice input';
  const statusLabel = statusText(voiceState);

  function handleClick() {
    if (speaking) {
      onBargeIn();
      return;
    }

    if (listening) {
      onStopListening();
      return;
    }

    onStartListening();
  }

  const Icon = speaking ? VolumeX : listening ? MicOff : Mic;

  return (
    <section className="voice-controls" aria-label="Voice controls">
      <button
        aria-label={buttonLabel}
        className={listening || speaking ? 'voice-button voice-button--active' : 'voice-button'}
        disabled={!chatEnabled || !voiceState.enabled}
        onClick={handleClick}
        type="button"
      >
        <Icon size={18} aria-hidden="true" />
      </button>
      <div className="voice-controls__status">
        <span>{statusLabel}</span>
        <CaptionBar text={captionText} />
      </div>
    </section>
  );
}

function statusText(voiceState: VoiceSessionState) {
  if (!voiceState.enabled) {
    return 'Voice off';
  }

  if (voiceState.status === 'listening') {
    return 'Listening';
  }

  if (voiceState.status === 'processing') {
    return 'Processing voice';
  }

  if (voiceState.status === 'speaking') {
    return 'Speaking';
  }

  if (voiceState.status === 'error') {
    return voiceState.lastError ?? 'Voice needs attention';
  }

  return 'Voice ready';
}
