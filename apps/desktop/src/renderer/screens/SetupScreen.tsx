import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, RotateCcw, Terminal, Trash2, XCircle } from 'lucide-react';
import { type SetupStatus } from '@bubbles/core';

interface SetupScreenProps {
  onStatusChange: (status: SetupStatus) => void;
  status?: SetupStatus | null;
}

export function SetupScreen({ onStatusChange, status: providedStatus = null }: SetupScreenProps) {
  const [status, setStatus] = useState<SetupStatus | null>(providedStatus);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (providedStatus) {
      setStatus(providedStatus);
    }
  }, [providedStatus]);

  useEffect(() => {
    let ignore = false;

    if (!window.bubbles?.setup) {
      return;
    }

    void window.bubbles.setup.getStatus().then((nextStatus) => {
      if (!ignore) {
        updateStatus(nextStatus);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  const headline = useMemo(() => getHeadline(status), [status]);
  const setupReady = status?.state === 'ready';
  const formMode = getFormMode(status);
  const setupApiAvailable = Boolean(window.bubbles?.setup);

  function updateStatus(nextStatus: SetupStatus) {
    setStatus(nextStatus);
    onStatusChange(nextStatus);
  }

  async function runSetupAction(action: () => Promise<SetupStatus>) {
    setBusy(true);

    try {
      updateStatus(await action());
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = keyInput.trim();

    if (!trimmedKey || !window.bubbles?.setup || !formMode) {
      return;
    }

    setKeyInput('');
    const action =
      formMode === 'general'
        ? () => window.bubbles!.setup.saveGeneralApiKey(trimmedKey)
        : () => window.bubbles!.setup.saveTokenPlanKey(trimmedKey);
    void runSetupAction(action);
  }

  if (!status) {
    return (
      <section className="setup-screen" data-testid="setup-screen" aria-label="MiniMax setup">
        <p className="setup-screen__status">
          <Loader2 size={16} aria-hidden="true" />
          Checking MiniMax setup
        </p>
        <SetupActionFooter busy={true} setupApiAvailable={setupApiAvailable} runSetupAction={runSetupAction} />
      </section>
    );
  }

  return (
    <section className="setup-screen" data-testid="setup-screen" aria-label="MiniMax setup">
      <div className="setup-screen__header">
        <div>
          <p className="eyebrow">MiniMax setup</p>
          <h2>{headline}</h2>
        </div>
        {setupReady ? (
          <CheckCircle2 className="setup-screen__icon setup-screen__icon--ready" size={20} aria-hidden="true" />
        ) : (
          <KeyRound className="setup-screen__icon" size={20} aria-hidden="true" />
        )}
      </div>

      {formMode ? (
        <form className="setup-form" onSubmit={handleSubmit}>
          <label htmlFor="minimax-setup-key">
            {formMode === 'general' ? 'MiniMax General API key' : 'MiniMax Token Plan Key for CLI'}
          </label>
          <div className="setup-form__row">
            <input
              id="minimax-setup-key"
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="sk-cp-..."
              type="password"
              value={keyInput}
            />
            <button type="submit" disabled={busy || !keyInput.trim()}>
              {busy ? 'Verifying' : formMode === 'general' ? 'Save General API key' : 'Save Token Plan key'}
            </button>
          </div>
        </form>
      ) : null}

      {status.state === 'needs_cli_install' ? (
        <div className="setup-cli-approval">
          <div>
            <p className="setup-screen__status">
              <Terminal size={16} aria-hidden="true" />
              {status.cli.installCommandPreview}
            </p>
          </div>
          <div className="setup-cli-approval__actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runSetupAction(() => window.bubbles!.setup.installCli())}
            >
              Install MiniMax CLI
            </button>
          </div>
        </div>
      ) : null}

      {status.state === 'ready' ? (
        <p className="setup-screen__status setup-screen__status--ready">MiniMax API and CLI are ready.</p>
      ) : null}

      {isWorking(status.state) ? (
        <p className="setup-screen__status">
          <Loader2 size={16} aria-hidden="true" />
          {headline}
        </p>
      ) : null}

      {status.generalApi.error ? (
        <p className="setup-screen__error">
          <XCircle size={16} aria-hidden="true" />
          {formatSetupError(status.generalApi.error)}
        </p>
      ) : null}

      {status.tokenPlan.error ? (
        <p className="setup-screen__error">
          <XCircle size={16} aria-hidden="true" />
          {formatSetupError(status.tokenPlan.error)}
        </p>
      ) : null}

      {status.cli.error ? (
        <p className="setup-screen__error">
          <XCircle size={16} aria-hidden="true" />
          {formatSetupError(status.cli.error)}
        </p>
      ) : null}

      <SetupActionFooter busy={busy} setupApiAvailable={setupApiAvailable} runSetupAction={runSetupAction} />
    </section>
  );
}

interface SetupActionFooterProps {
  busy: boolean;
  runSetupAction: (action: () => Promise<SetupStatus>) => Promise<void>;
  setupApiAvailable: boolean;
}

function SetupActionFooter({ busy, runSetupAction, setupApiAvailable }: SetupActionFooterProps) {
  const disabled = busy || !setupApiAvailable;

  return (
    <div className="setup-screen__footer">
      <button
        className="icon-text-button"
        type="button"
        disabled={disabled}
        onClick={() => void runSetupAction(() => window.bubbles!.setup.retry())}
      >
        <RotateCcw size={15} aria-hidden="true" />
        Recheck CLI
      </button>
      <button
        className="icon-text-button secondary-button"
        type="button"
        disabled={disabled}
        onClick={() => void runSetupAction(() => window.bubbles!.setup.resetGeneralApiKey())}
      >
        <KeyRound size={15} aria-hidden="true" />
        Reset General API key
      </button>
      <button
        className="icon-text-button secondary-button"
        type="button"
        disabled={disabled}
        onClick={() => void runSetupAction(() => window.bubbles!.setup.resetTokenPlanKey())}
      >
        <Trash2 size={15} aria-hidden="true" />
        Reset Token Plan key
      </button>
      <button
        className="secondary-button"
        type="button"
        disabled={disabled}
        onClick={() => void runSetupAction(() => window.bubbles!.setup.resetAllMiniMax())}
      >
        Reset all
      </button>
    </div>
  );
}

function getFormMode(status: SetupStatus | null) {
  if (!status) {
    return null;
  }

  if (status.state === 'needs_general_api_key') {
    return 'general';
  }

  if (status.state === 'needs_token_plan_key') {
    return 'token';
  }

  if (
    status.state === 'setup_error' &&
    !status.generalApi.verified &&
    !(status.tokenPlan.present && isTransientSetupError(status.generalApi.error))
  ) {
    return 'general';
  }

  if (
    status.state === 'setup_error' &&
    status.generalApi.verified &&
    !status.tokenPlan.verified &&
    !(status.tokenPlan.present && status.cli.error)
  ) {
    return 'token';
  }

  return null;
}

function isWorking(state: SetupStatus['state']) {
  return state === 'checking_cli' || state === 'authenticating_cli' || state === 'verifying_general_api' || state === 'verifying_cli';
}

function formatSetupError(error: string) {
  if (/EACCES|permission denied/i.test(error)) {
    return 'MiniMax CLI install hit a permissions error. Setup stays incomplete until mmx is available.';
  }

  if (/API key failed validation against all regions|Detecting region|status 401/i.test(error)) {
    return 'MiniMax CLI requires a Token Plan Key. Your General API key still works for direct Bubbles features.';
  }

  const compact = error.replace(/\s+/g, ' ').trim();
  const maxLength = 220;

  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact;
}

function isTransientSetupError(error: string | undefined) {
  return Boolean(error && /fetch failed|network|connection|timeout|ENOTFOUND|ECONN|ETIMEDOUT/i.test(error));
}

function getHeadline(status: SetupStatus | null) {
  switch (status?.state) {
    case 'authenticating_cli':
      return 'Authenticating CLI';
    case 'checking_cli':
      return 'Checking CLI';
    case 'needs_cli_install':
      return 'CLI approval needed';
    case 'needs_token_plan_key':
      return 'Connect Token Plan';
    case 'ready':
      return 'MiniMax ready';
    case 'setup_error':
      return 'Setup needs attention';
    case 'verifying_cli':
      return 'Verifying CLI';
    case 'verifying_general_api':
      return 'Verifying General API';
    case 'needs_general_api_key':
    default:
      return 'Connect MiniMax';
  }
}
