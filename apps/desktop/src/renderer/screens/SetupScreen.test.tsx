import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SetupScreen } from './SetupScreen';
import { type SetupStatus } from '@bubbles/core';

const needsGeneralApiKeyStatus = createStatus({ state: 'needs_general_api_key' });

describe('SetupScreen', () => {
  it('renders General API key entry first', async () => {
    const restore = mockSetupApi({ getStatus: vi.fn().mockResolvedValue(needsGeneralApiKeyStatus) });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByLabelText('MiniMax General API key')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save General API key' })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('saves the General API key through explicit setup IPC and clears the input', async () => {
    const saveGeneralApiKey = vi.fn().mockResolvedValue(createStatus({ state: 'needs_token_plan_key' }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(needsGeneralApiKeyStatus),
      saveGeneralApiKey
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      const input = await screen.findByLabelText('MiniMax General API key');
      fireEvent.change(input, { target: { value: 'sk-cp-general-key' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save General API key' }));

      await waitFor(() => expect(saveGeneralApiKey).toHaveBeenCalledWith('sk-cp-general-key'));
      expect(input).toHaveValue('');
      expect(screen.queryByText('sk-cp-general-key')).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('requires the Token Plan key after General API verification', async () => {
    const saveTokenPlanKey = vi.fn().mockResolvedValue(createStatus({ state: 'needs_cli_install' }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(createStatus({ state: 'needs_token_plan_key' })),
      saveTokenPlanKey
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      const input = await screen.findByLabelText('MiniMax Token Plan Key for CLI');
      fireEvent.change(input, { target: { value: 'sk-cp-token-key' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Token Plan key' }));

      await waitFor(() => expect(saveTokenPlanKey).toHaveBeenCalledWith('sk-cp-token-key'));
      expect(screen.queryByRole('button', { name: 'Continue API-only' })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('does not install CLI until the approval button is clicked', async () => {
    const appLocalPreview = 'npm install --global --prefix /Users/dev/Library/Application Support/Bubbles/tools/mmx-cli mmx-cli';
    const installCli = vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(
        createStatus({
          state: 'needs_cli_install',
          tokenPlan: {
            present: true,
            verified: false
          },
          cli: {
            installed: false,
            authenticated: false,
            verified: false,
            installCommandPreview: appLocalPreview
          }
        })
      ),
      installCli
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText(appLocalPreview)).toBeInTheDocument();
      expect(installCli).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Install MiniMax CLI' }));

      await waitFor(() => expect(installCli).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('button', { name: 'Continue API-only' })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('keeps npm permission failures concise while setup remains incomplete', async () => {
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(
        createStatus({
          state: 'setup_error',
          cli: {
            installed: false,
            authenticated: false,
            verified: false,
            installCommandPreview: 'npm install --global --prefix /Users/dev/Bubbles/tools/mmx-cli mmx-cli',
            error: [
              'npm error code EACCES',
              "npm error path /usr/local/lib/node_modules/mmx-cli",
              'npm error at async Arborist.reify (/usr/local/lib/node_modules/npm/node_modules/@npmcli/arborist/lib/arborist/reify.js:142:5)',
              'npm error A complete log of this run can be found in: /Users/dev/.npm/_logs/debug-0.log'
            ].join('\n')
          }
        })
      )
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText(/MiniMax CLI install hit a permissions error/)).toBeInTheDocument();
      expect(screen.queryByText(/Arborist\.reify/)).not.toBeInTheDocument();
      expect(screen.queryByText(/debug-0\.log/)).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('explains that CLI validation failures need a Token Plan key', async () => {
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(
        createStatus({
          state: 'needs_token_plan_key',
          tokenPlan: {
            present: false,
            verified: false,
            error: [
              'Detecting region... failed Warning:',
              'API key failed validation against all regions (global, cn).',
              'Subsequent request failed with status 401'
            ].join(' ')
          },
          cli: {
            installed: true,
            authenticated: false,
            verified: false,
            installCommandPreview: 'npm install --global --prefix /Users/dev/Bubbles/tools/mmx-cli mmx-cli'
          }
        })
      )
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText(/MiniMax CLI requires a Token Plan Key/)).toBeInTheDocument();
      expect(screen.queryByText(/Detecting region/)).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('shows ready only when both MiniMax API and CLI are ready', async () => {
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }))
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText('MiniMax ready')).toBeInTheDocument();
      expect(screen.getByText('MiniMax API and CLI are ready.')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('redacts setup errors in the UI', async () => {
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(
        createStatus({
          state: 'setup_error',
          generalApi: { verified: false, error: 'bad key [REDACTED]' }
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

  it('treats runtime CLI health failures as recheckable setup errors, not Token Plan re-entry', async () => {
    const retry = vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(
        createStatus({
          state: 'setup_error',
          generalApi: { verified: true },
          tokenPlan: { present: true, verified: true },
          cli: {
            installed: true,
            authenticated: true,
            verified: false,
            installCommandPreview: 'npm install -g mmx-cli',
            error: 'MiniMax CLI cannot reach the network right now.'
          }
        })
      ),
      retry
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText('Setup needs attention')).toBeInTheDocument();
      expect(screen.queryByLabelText('MiniMax Token Plan Key for CLI')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Recheck CLI' }));

      await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('MiniMax ready')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('treats transient General API fetch failures as recheckable when the CLI key is present', async () => {
    const retry = vi.fn().mockResolvedValue(createStatus({ state: 'ready', mode: 'full' }));
    const restore = mockSetupApi({
      getStatus: vi.fn().mockResolvedValue(
        createStatus({
          state: 'setup_error',
          generalApi: { verified: false, error: 'fetch failed' },
          tokenPlan: { present: true, verified: true },
          cli: {
            installed: true,
            authenticated: true,
            verified: false,
            installCommandPreview: 'npm install -g mmx-cli',
            error: 'MiniMax CLI cannot reach the network right now.'
          }
        })
      ),
      retry
    });

    try {
      render(<SetupScreen onStatusChange={vi.fn()} />);

      expect(await screen.findByText('Setup needs attention')).toBeInTheDocument();
      expect(screen.queryByLabelText('MiniMax General API key')).not.toBeInTheDocument();
      expect(screen.getByText('fetch failed')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Recheck CLI' }));

      await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('MiniMax ready')).toBeInTheDocument();
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
      getStatus: vi.fn().mockResolvedValue(needsGeneralApiKeyStatus),
      installCli: vi.fn(),
      resetAllMiniMax: vi.fn(),
      resetGeneralApiKey: vi.fn(),
      resetTokenPlanKey: vi.fn(),
      retry: vi.fn(),
      saveGeneralApiKey: vi.fn(),
      saveTokenPlanKey: vi.fn(),
      ...overrides
    },
    togglePanel: vi.fn().mockResolvedValue({ isOpen: true })
  };

  return () => {
    window.bubbles = previousBubbles;
  };
}

function createStatus(overrides: Partial<SetupStatus> = {}): SetupStatus {
  return {
    state: 'needs_general_api_key',
    mode: 'not_configured',
    generalApi: { verified: false },
    tokenPlan: { present: false, verified: false },
    cli: {
      installed: false,
      authenticated: false,
      verified: false,
      installCommandPreview: 'npm install -g mmx-cli'
    },
    updatedAt: '2026-05-14T10:00:00.000Z',
    ...overrides
  };
}
