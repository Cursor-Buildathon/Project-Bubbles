import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { type SetupStatus, type TavilySetupStatus, type VoiceSetupStatus } from '@bubbles/core';

interface SetupScreenProps {
  onStatusChange: (status: SetupStatus) => void;
  status?: SetupStatus | null;
}

export function SetupScreen({ onStatusChange, status: providedStatus = null }: SetupScreenProps) {
  const [status, setStatus] = useState<SetupStatus | null>(providedStatus);
  const [tavilyStatus, setTavilyStatus] = useState<TavilySetupStatus | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceSetupStatus | null>(null);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [openAiKeyInput, setOpenAiKeyInput] = useState('');
  const [tavilyKeyInput, setTavilyKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tavilyBusy, setTavilyBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);

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

  useEffect(() => {
    let ignore = false;

    if (!window.bubbles?.tavilySetup) {
      return;
    }

    void window.bubbles.tavilySetup.getStatus().then((nextStatus) => {
      if (!ignore) {
        setTavilyStatus(nextStatus);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    return window.bubbles?.tavilySetup?.onStatusChange?.((nextStatus) => setTavilyStatus(nextStatus));
  }, []);

  useEffect(() => {
    let ignore = false;

    if (!window.bubbles?.voiceSetup) {
      return;
    }

    void window.bubbles.voiceSetup.getStatus().then((nextStatus) => {
      if (!ignore) {
        setVoiceStatus(nextStatus);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    return window.bubbles?.voiceSetup?.onStatusChange?.((nextStatus) => setVoiceStatus(nextStatus));
  }, []);

  const headline = useMemo(() => getHeadline(status), [status]);
  const setupReady = status?.state === 'ready';
  const shouldShowTokenForm = getShouldShowTokenForm(status);
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

  async function runVoiceSetupAction(action: () => Promise<VoiceSetupStatus>) {
    setVoiceBusy(true);

    try {
      setVoiceStatus(await action());
    } finally {
      setVoiceBusy(false);
    }
  }

  async function runTavilySetupAction(action: () => Promise<TavilySetupStatus>) {
    setTavilyBusy(true);

    try {
      setTavilyStatus(await action());
    } finally {
      setTavilyBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = keyInput.trim();

    if (!trimmedKey || !window.bubbles?.setup || !shouldShowTokenForm) {
      return;
    }

    setKeyInput('');
    void runSetupAction(() => window.bubbles!.setup.saveTokenPlanKey(trimmedKey));
  }

  function handleGeminiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = geminiKeyInput.trim();

    if (!trimmedKey || !window.bubbles?.voiceSetup) {
      return;
    }

    setGeminiKeyInput('');
    void runVoiceSetupAction(() => window.bubbles!.voiceSetup!.saveGeminiKey(trimmedKey));
  }

  function handleOpenAiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = openAiKeyInput.trim();

    if (!trimmedKey || !window.bubbles?.voiceSetup) {
      return;
    }

    setOpenAiKeyInput('');
    void runVoiceSetupAction(() => window.bubbles!.voiceSetup!.saveOpenAiKey(trimmedKey));
  }

  function handleTavilySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = tavilyKeyInput.trim();

    if (!trimmedKey || !window.bubbles?.tavilySetup) {
      return;
    }

    setTavilyKeyInput('');
    void runTavilySetupAction(() => window.bubbles!.tavilySetup!.saveApiKey(trimmedKey));
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

      {shouldShowTokenForm ? (
        <form className="setup-form" onSubmit={handleSubmit}>
          <label htmlFor="minimax-setup-key">MiniMax Token Plan key</label>
          <div className="setup-form__row">
            <input
              id="minimax-setup-key"
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="sk-cp-..."
              type="password"
              value={keyInput}
            />
            <button type="submit" disabled={busy || !keyInput.trim()}>
              {busy ? 'Verifying' : 'Save Token Plan key'}
            </button>
          </div>
        </form>
      ) : null}

      {status.state === 'ready' ? (
        <p className="setup-screen__status setup-screen__status--ready">MiniMax API is ready.</p>
      ) : null}

      {isWorking(status.state) ? (
        <p className="setup-screen__status">
          <Loader2 size={16} aria-hidden="true" />
          {headline}
        </p>
      ) : null}

      {status.tokenPlan.error ? (
        <p className="setup-screen__error">
          <XCircle size={16} aria-hidden="true" />
          {formatSetupError(status.tokenPlan.error)}
        </p>
      ) : null}

      <SetupActionFooter busy={busy} setupApiAvailable={setupApiAvailable} runSetupAction={runSetupAction} />
      <TavilySetupSection
        busy={tavilyBusy}
        keyInput={tavilyKeyInput}
        onKeyInput={setTavilyKeyInput}
        onSubmit={handleTavilySubmit}
        runTavilySetupAction={runTavilySetupAction}
        status={tavilyStatus}
      />
      <VoiceSetupSection
        busy={voiceBusy}
        geminiKeyInput={geminiKeyInput}
        onGeminiKeyInput={setGeminiKeyInput}
        onGeminiSubmit={handleGeminiSubmit}
        onOpenAiKeyInput={setOpenAiKeyInput}
        onOpenAiSubmit={handleOpenAiSubmit}
        openAiKeyInput={openAiKeyInput}
        runVoiceSetupAction={runVoiceSetupAction}
        status={voiceStatus}
      />
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
        Recheck MiniMax
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

function getShouldShowTokenForm(status: SetupStatus | null) {
  if (!status) {
    return false;
  }

  if (status.state === 'needs_token_plan_key') {
    return true;
  }

  if (status.state === 'setup_error' && !status.tokenPlan.verified && !isTransientSetupError(status.tokenPlan.error)) {
    return true;
  }

  return false;
}

function isWorking(state: SetupStatus['state']) {
  return state === 'verifying_token_plan';
}

function formatSetupError(error: string) {
  const compact = error.replace(/\s+/g, ' ').trim();
  const maxLength = 220;

  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact;
}

function isTransientSetupError(error: string | undefined) {
  return Boolean(error && /fetch failed|network|connection|timeout|ENOTFOUND|ECONN|ETIMEDOUT/i.test(error));
}

function getHeadline(status: SetupStatus | null) {
  switch (status?.state) {
    case 'needs_token_plan_key':
      return 'Connect Token Plan';
    case 'ready':
      return 'MiniMax ready';
    case 'setup_error':
      return 'Setup needs attention';
    case 'verifying_token_plan':
      return 'Verifying Token Plan';
    default:
      return 'Connect MiniMax';
  }
}

interface TavilySetupSectionProps {
  busy: boolean;
  keyInput: string;
  onKeyInput: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  runTavilySetupAction: (action: () => Promise<TavilySetupStatus>) => Promise<void>;
  status: TavilySetupStatus | null;
}

function TavilySetupSection({ busy, keyInput, onKeyInput, onSubmit, runTavilySetupAction, status }: TavilySetupSectionProps) {
  const tavilySetupAvailable = Boolean(window.bubbles?.tavilySetup);
  const disabled = busy || !tavilySetupAvailable;

  return (
    <section className="setup-screen__voice" aria-label="Tavily setup">
      <div className="setup-screen__header">
        <div>
          <p className="eyebrow">Tavily setup</p>
          <h2>{tavilyHeadline(status)}</h2>
        </div>
      </div>
      <p className={status?.state === 'ready' ? 'setup-screen__status setup-screen__status--ready' : 'setup-screen__status'}>
        {tavilyStatusText(status)}
      </p>
      <form className="setup-form" onSubmit={onSubmit}>
        <label htmlFor="tavily-api-key">Tavily API key</label>
        <div className="setup-form__row">
          <input
            id="tavily-api-key"
            onChange={(event) => onKeyInput(event.target.value)}
            placeholder={status?.state === 'ready' ? 'Configured' : 'tvly-...'}
            type="password"
            value={keyInput}
          />
          <button type="submit" disabled={disabled || !keyInput.trim()}>
            {busy ? 'Verifying' : 'Save Tavily key'}
          </button>
        </div>
      </form>
      {status?.error ? <p className="setup-screen__error">{formatSetupError(status.error)}</p> : null}
      <div className="setup-screen__footer">
        <button
          className="icon-text-button"
          disabled={disabled}
          onClick={() => void runTavilySetupAction(() => window.bubbles!.tavilySetup!.retry())}
          type="button"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Recheck Tavily
        </button>
        <button
          className="icon-text-button secondary-button"
          disabled={disabled}
          onClick={() => void runTavilySetupAction(() => window.bubbles!.tavilySetup!.resetApiKey())}
          type="button"
        >
          <Trash2 size={15} aria-hidden="true" />
          Reset Tavily key
        </button>
      </div>
    </section>
  );
}

function tavilyHeadline(status: TavilySetupStatus | null) {
  if (!status) {
    return 'Checking Tavily';
  }

  if (status.state === 'ready') {
    return 'Tavily ready';
  }

  if (status.state === 'verifying') {
    return 'Verifying Tavily';
  }

  return 'Connect Tavily';
}

function tavilyStatusText(status: TavilySetupStatus | null) {
  if (!status) {
    return 'Checking Tavily Remote MCP.';
  }

  if (status.state === 'ready') {
    return 'Tavily Remote MCP is ready for live research.';
  }

  if (status.state === 'setup_error') {
    return 'Tavily setup needs attention.';
  }

  if (status.state === 'verifying') {
    return 'Verifying Tavily Remote MCP.';
  }

  return 'Add a Tavily API key for live web research.';
}

interface VoiceSetupSectionProps {
  busy: boolean;
  geminiKeyInput: string;
  onGeminiKeyInput: (value: string) => void;
  onGeminiSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenAiKeyInput: (value: string) => void;
  onOpenAiSubmit: (event: FormEvent<HTMLFormElement>) => void;
  openAiKeyInput: string;
  runVoiceSetupAction: (action: () => Promise<VoiceSetupStatus>) => Promise<void>;
  status: VoiceSetupStatus | null;
}

function VoiceSetupSection({
  busy,
  geminiKeyInput,
  onGeminiKeyInput,
  onGeminiSubmit,
  onOpenAiKeyInput,
  onOpenAiSubmit,
  openAiKeyInput,
  runVoiceSetupAction,
  status
}: VoiceSetupSectionProps) {
  const voiceSetupAvailable = Boolean(window.bubbles?.voiceSetup);
  const disabled = busy || !voiceSetupAvailable;

  return (
    <section className="setup-screen__voice" aria-label="Voice setup">
      <div className="setup-screen__header">
        <div>
          <p className="eyebrow">Voice setup</p>
          <h2>{voiceHeadline(status)}</h2>
        </div>
      </div>
      <p className={status?.stt.ready && status.tts.ready ? 'setup-screen__status setup-screen__status--ready' : 'setup-screen__status'}>
        {voiceStatusText(status)}
      </p>

      <form className="setup-form" onSubmit={onGeminiSubmit}>
        <label htmlFor="voice-gemini-key">Gemini STT key</label>
        <div className="setup-form__row">
          <input
            id="voice-gemini-key"
            onChange={(event) => onGeminiKeyInput(event.target.value)}
            placeholder={status?.stt.gemini.present ? 'Configured' : 'Gemini API key'}
            type="password"
            value={geminiKeyInput}
          />
          <button type="submit" disabled={disabled || !geminiKeyInput.trim()}>
            Save Gemini key
          </button>
        </div>
      </form>

      <form className="setup-form" onSubmit={onOpenAiSubmit}>
        <label htmlFor="voice-openai-key">OpenAI STT fallback key</label>
        <div className="setup-form__row">
          <input
            id="voice-openai-key"
            onChange={(event) => onOpenAiKeyInput(event.target.value)}
            placeholder={status?.stt.openai.present ? 'Configured' : 'OpenAI API key'}
            type="password"
            value={openAiKeyInput}
          />
          <button type="submit" disabled={disabled || !openAiKeyInput.trim()}>
            Save OpenAI key
          </button>
        </div>
      </form>

      <div className="setup-screen__footer">
        <button
          className="icon-text-button secondary-button"
          disabled={disabled}
          onClick={() => void runVoiceSetupAction(() => window.bubbles!.voiceSetup!.resetGeminiKey())}
          type="button"
        >
          <Trash2 size={15} aria-hidden="true" />
          Reset Gemini key
        </button>
        <button
          className="icon-text-button secondary-button"
          disabled={disabled}
          onClick={() => void runVoiceSetupAction(() => window.bubbles!.voiceSetup!.resetOpenAiKey())}
          type="button"
        >
          <Trash2 size={15} aria-hidden="true" />
          Reset OpenAI key
        </button>
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={() => void runVoiceSetupAction(() => window.bubbles!.voiceSetup!.resetAllVoiceKeys())}
          type="button"
        >
          Reset voice
        </button>
      </div>
    </section>
  );
}

function voiceHeadline(status: VoiceSetupStatus | null) {
  if (!status) {
    return 'Checking voice';
  }

  if (!status.enabled) {
    return 'Voice off';
  }

  if (status.stt.ready && status.tts.ready) {
    return 'Voice ready';
  }

  return 'Voice needs setup';
}

function voiceStatusText(status: VoiceSetupStatus | null) {
  if (!status) {
    return 'Checking voice providers.';
  }

  if (!status.enabled) {
    return 'Voice is disabled by environment settings.';
  }

  if (!status.stt.ready) {
    return 'Add a Gemini key for live voice input. Add OpenAI as fallback for quota-safe smoke tests.';
  }

  if (!status.tts.ready) {
    return 'MiniMax Token Plan key is required for voice playback.';
  }

  return `Voice input uses ${status.stt.preferredProvider === 'openai' ? 'OpenAI' : 'Gemini'} STT in English. OpenAI fallback is recommended for smoke tests.`;
}
