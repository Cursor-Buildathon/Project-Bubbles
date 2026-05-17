import { Mic, MicOff } from 'lucide-react';
import { type VoiceSessionState } from '@bubbles/core';
import { CaptionBar } from './CaptionBar';

interface VoiceControlsProps {
  chatEnabled: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  voiceState: VoiceSessionState;
}

export function VoiceControls({
  chatEnabled,
  onStartListening,
  onStopListening,
  voiceState
}: VoiceControlsProps) {
  const listening = voiceState.status === 'listening' || voiceState.status === 'processing';
  const speaking = voiceState.status === 'speaking';
  const captionText = voiceState.partialText || voiceState.captionText;
  const shortcutHint = 'CommandOrControl+Shift+Space';
  const buttonLabel = listening ? 'Stop voice input' : `Start voice input (${shortcutHint})`;
  const statusLabel = statusText(voiceState);

  function handleClick() {
    if (listening) {
      onStopListening();
      return;
    }

    onStartListening();
  }

  const Icon = listening ? MicOff : Mic;

  return (
    <section className="voice-controls" aria-label="Voice controls">
      <button
        aria-label={buttonLabel}
        className={listening || speaking ? 'voice-button voice-button--active' : 'voice-button'}
        disabled={!chatEnabled || !voiceState.enabled}
        onClick={handleClick}
        title={buttonLabel}
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
