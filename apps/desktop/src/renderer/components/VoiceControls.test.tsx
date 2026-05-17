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
        onStartListening={onStartListening}
        onStopListening={vi.fn()}
        voiceState={createVoiceState()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start voice input (CommandOrControl+Shift+Space)' }));

    expect(onStartListening).toHaveBeenCalled();
    expect(screen.getByText('Voice ready')).toBeInTheDocument();
  });

  it('stops listening while active and shows partial transcripts', () => {
    const onStopListening = vi.fn();

    render(
      <VoiceControls
        chatEnabled
        onStartListening={vi.fn()}
        onStopListening={onStopListening}
        voiceState={createVoiceState({ status: 'listening', partialText: 'Help me' })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop voice input' }));

    expect(onStopListening).toHaveBeenCalled();
    expect(screen.getByText('Help me')).toBeInTheDocument();
  });

  it('starts a new voice input while Bubbles is speaking', () => {
    const onStartListening = vi.fn();

    render(
      <VoiceControls
        chatEnabled
        onStartListening={onStartListening}
        onStopListening={vi.fn()}
        voiceState={createVoiceState({ status: 'speaking', captionText: 'A spoken answer.' })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start voice input (CommandOrControl+Shift+Space)' }));

    expect(onStartListening).toHaveBeenCalled();
    expect(screen.getByText('A spoken answer.')).toBeInTheDocument();
  });

  it('does not expose the removed wake phrase toggle', () => {
    const onStartListening = vi.fn();

    render(
      <VoiceControls
        chatEnabled
        onStartListening={onStartListening}
        onStopListening={vi.fn()}
        voiceState={createVoiceState({ mode: 'always-listening', status: 'listening' })}
      />
    );

    expect(screen.queryByRole('button', { name: /wake phrase/i })).not.toBeInTheDocument();
    expect(screen.getByText('Listening')).toBeInTheDocument();
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
