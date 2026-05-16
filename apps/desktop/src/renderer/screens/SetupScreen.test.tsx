import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SetupScreen } from './SetupScreen';
import { type SetupStatus, type TavilySetupStatus, type VoiceSetupStatus } from '@bubbles/core';

const needsTokenPlanStatus = createStatus({ state: 'needs_token_plan_key' });

describe('SetupScreen', () => {
  it('renders Token Plan key entry first', async () => {
    const restore = mockSetupApi({ getStatus: vi.fn().mockResolvedValue(needsTokenPlanStatus) });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByLabelText('MiniMax Token Plan key')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Token Plan key' })).toBeInTheDocument();
      expect(screen.queryByText(/General API/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/CLI/i)).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('saves the Token Plan key through setup IPC and clears the input', async () => {
    const saveTokenPlanKey = vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(needsTokenPlanStatus),
      saveTokenPlanKey
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      const input = await screen.findByLabelText('MiniMax Token Plan key');
      fireEvent.change(input, { target: { value: 'sk-cp-token-key' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Token Plan key' }));

      await waitFor(() => expect(saveTokenPlanKey).toHaveBeenCalledWith('sk-cp-token-key'));
      expect(input).toHaveValue('');
      expect(screen.queryByText('sk-cp-token-key')).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('shows direct MiniMax API readiness without CLI copy', async () => {
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }))
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText('MiniMax ready')).toBeInTheDocument();
      expect(screen.getByText('MiniMax API is ready.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Install/ })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('saves optional voice STT keys through voice setup IPC', async () => {
    const saveGeminiKey = vi.fn().mockResolvedValue(createVoiceStatus({ stt: createSttStatus({ gemini: { present: true, verified: true } }) }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }))
    });
    window.bubbles!.voiceSetup!.saveGeminiKey = saveGeminiKey;

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      const input = await screen.findByLabelText('Gemini STT key');
      expect(screen.getByLabelText('OpenAI STT fallback key')).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'gemini-secret-key' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Gemini key' }));

      await waitFor(() => expect(saveGeminiKey).toHaveBeenCalledWith('gemini-secret-key'));
      expect(input).toHaveValue('');
      expect(screen.queryByText('gemini-secret-key')).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('saves the Tavily API key through Tavily setup IPC', async () => {
    const saveApiKey = vi.fn().mockResolvedValue(createTavilyStatus({ state: 'ready' }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }))
    });
    window.bubbles!.tavilySetup!.saveApiKey = saveApiKey;

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      const input = await screen.findByLabelText('Tavily API key');
      fireEvent.change(input, { target: { value: 'tvly-secret-key' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Tavily key' }));

      await waitFor(() => expect(saveApiKey).toHaveBeenCalledWith('tvly-secret-key'));
      expect(input).toHaveValue('');
      expect(screen.queryByText('tvly-secret-key')).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('treats transient API health failures as recheckable setup errors', async () => {
    const retry = vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(
        createStatus({
          state: 'setup_error',
          tokenPlan: {
            present: true,
            verified: false,
            error: 'MiniMax API cannot reach the network right now.'
          }
        })
      ),
      retry
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText('Setup needs attention')).toBeInTheDocument();
      expect(screen.queryByLabelText('MiniMax Token Plan key')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Recheck MiniMax' }));

      await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('MiniMax ready')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('redacts setup errors in the UI', async () => {
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(
        createStatus({
          state: 'setup_error',
          tokenPlan: { present: false, verified: false, error: 'bad key [REDACTED]' }
        })
      )
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText('bad key [REDACTED]')).toBeInTheDocument();
      expect(screen.queryByText(/sk-cp-secret/)).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });
});

function mockSetupApi(overrides: Partial<NonNullable<typeof window.bubbles>['setup']>) {
  const previousBubbles = window.bubbles;
  window.bubbles = {
    closePanel: vi.fn().mockResolvedValue({ isOpen: false }),
    getState: vi.fn().mockReturnValue(new Promise(() => undefined)),
    moveWindowBy: vi.fn().mockResolvedValue(undefined),
    onPanelStateChange: vi.fn(() => () => undefined),
    onStateChange: vi.fn(() => () => undefined),
    platform: 'darwin',
    phase: 'phase-2',
    sendMessage: vi.fn().mockResolvedValue({ avatarState: 'idle', messages: [] }),
    setAvatarState: vi.fn().mockResolvedValue({ avatarState: 'idle', messages: [] }),
    setup: {
      getStatus: vi.fn().mockResolvedValue(needsTokenPlanStatus),
      resetAllMiniMax: vi.fn(),
      resetTokenPlanKey: vi.fn(),
      retry: vi.fn(),
      saveTokenPlanKey: vi.fn(),
      ...overrides
    },
    tavilySetup: {
      getStatus: vi.fn().mockResolvedValue(createTavilyStatus()),
      onStatusChange: vi.fn(() => () => undefined),
      resetApiKey: vi.fn().mockResolvedValue(createTavilyStatus()),
      retry: vi.fn().mockResolvedValue(createTavilyStatus()),
      saveApiKey: vi.fn().mockResolvedValue(createTavilyStatus())
    },
    voiceSetup: {
      getStatus: vi.fn().mockResolvedValue(createVoiceStatus()),
      onStatusChange: vi.fn(() => () => undefined),
      resetAllVoiceKeys: vi.fn().mockResolvedValue(createVoiceStatus()),
      resetGeminiKey: vi.fn().mockResolvedValue(createVoiceStatus()),
      resetOpenAiKey: vi.fn().mockResolvedValue(createVoiceStatus()),
      saveGeminiKey: vi.fn().mockResolvedValue(createVoiceStatus()),
      saveOpenAiKey: vi.fn().mockResolvedValue(createVoiceStatus())
    },
    togglePanel: vi.fn().mockResolvedValue({ isOpen: true })
  };

  return () => {
    window.bubbles = previousBubbles;
  };
}

function createTavilyStatus(overrides: Partial<TavilySetupStatus> = {}): TavilySetupStatus {
  return {
    state: 'needs_api_key',
    updatedAt: '2026-05-14T10:00:00.000Z',
    ...overrides
  };
}

function createVoiceStatus(overrides: Partial<VoiceSetupStatus> = {}): VoiceSetupStatus {
  return {
    enabled: true,
    stt: createSttStatus(),
    tts: { provider: 'minimax', ready: false },
    updatedAt: '2026-05-14T10:00:00.000Z',
    ...overrides
  };
}

function createSttStatus(
  overrides: Partial<VoiceSetupStatus['stt']> = {}
): VoiceSetupStatus['stt'] {
  return {
    gemini: { present: false, verified: false },
    openai: { present: false, verified: false },
    ready: false,
    ...overrides
  };
}

function createStatus(overrides: Partial<SetupStatus> = {}): SetupStatus {
  return {
    state: 'needs_token_plan_key',
    mode: 'not_configured',
    tokenPlan: { present: false, verified: false },
    updatedAt: '2026-05-14T10:00:00.000Z',
    ...overrides
  };
}
