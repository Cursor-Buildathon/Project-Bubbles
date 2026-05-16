import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { type VoiceSessionState } from '@bubbles/core';
import { VoiceControls } from './VoiceControls';

describe('VoiceControls', () => {
  it('starts listening from idle state', () => {
    const onStartListening = vi.fn();

    render(
      <VoiceControls
        chatEnabled
        onBargeIn={vi.fn()}
        onStartListening={onStartListening}
        onStopListening={vi.fn()}
        onToggleWakePhrase={vi.fn()}
        voiceState={createVoiceState()}
        wakePhrase="Hi Bubbles"
        wakePhraseEnabled={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }));

    expect(onStartListening).toHaveBeenCalled();
    expect(screen.getByText('Voice ready')).toBeInTheDocument();
  });

  it('stops listening while active and shows partial transcripts', () => {
    const onStopListening = vi.fn();

    render(
      <VoiceControls
        chatEnabled
        onBargeIn={vi.fn()}
        onStartListening={vi.fn()}
        onStopListening={onStopListening}
        onToggleWakePhrase={vi.fn()}
        voiceState={createVoiceState({ status: 'listening', partialText: 'Help me' })}
        wakePhrase="Hi Bubbles"
        wakePhraseEnabled={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop voice input' }));

    expect(onStopListening).toHaveBeenCalled();
    expect(screen.getByText('Help me')).toBeInTheDocument();
  });

  it('uses barge-in while Bubbles is speaking', () => {
    const onBargeIn = vi.fn();

    render(
      <VoiceControls
        chatEnabled
        onBargeIn={onBargeIn}
        onStartListening={vi.fn()}
        onStopListening={vi.fn()}
        onToggleWakePhrase={vi.fn()}
        voiceState={createVoiceState({ status: 'speaking', captionText: 'A spoken answer.' })}
        wakePhrase="Hi Bubbles"
        wakePhraseEnabled={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Barge in' }));

    expect(onBargeIn).toHaveBeenCalled();
    expect(screen.getByText('A spoken answer.')).toBeInTheDocument();
  });

  it('toggles the wake phrase listener', () => {
    const onToggleWakePhrase = vi.fn();

    render(
      <VoiceControls
        chatEnabled
        onBargeIn={vi.fn()}
        onStartListening={vi.fn()}
        onStopListening={vi.fn()}
        onToggleWakePhrase={onToggleWakePhrase}
        voiceState={createVoiceState({ mode: 'always-listening', status: 'listening' })}
        wakePhrase="Hi Bubbles"
        wakePhraseEnabled
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disable Hi Bubbles wake phrase' }));

    expect(onToggleWakePhrase).toHaveBeenCalled();
    expect(screen.getByText('Wake phrase listening')).toBeInTheDocument();
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
