import { FormEvent, useState } from 'react';
import { Download, Send, Sparkles } from 'lucide-react';
import { type ChatMessage } from '../App';

interface ChatSurfaceProps {
  chatEnabled: boolean;
  draft: string;
  messages: ChatMessage[];
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChatSurface({ chatEnabled, draft, messages, onDraftChange, onSubmit }: ChatSurfaceProps) {
  return (
    <section className="chat-window active-chat" data-testid="chat-surface" aria-label="Active chat">
      <span className="visually-hidden" data-testid="active-chat">
        Active chat
      </span>
      <div className="chat-window__messages" role="log" aria-label="Chat messages" aria-live="polite">
        {messages.length ? (
          messages.map((message) => (
            <article className={`chat-message chat-message--${message.author}`} key={message.id}>
              <span className="chat-message__author">{message.author === 'bubbles' ? 'Bubbles' : 'You'}</span>
              <p>{message.text}</p>
              {message.citations?.length ? (
                <div className="chat-message__citations" aria-label="Sources">
                  {message.citations.map((citation) => (
                    <a aria-label={citation.title} href={citation.url} key={citation.url} rel="noreferrer" target="_blank">
                      <span>{citation.title}</span>
                      {citation.snippet ? <small>{citation.snippet}</small> : null}
                    </a>
                  ))}
                </div>
              ) : null}
              {message.artifacts?.length ? (
                <div className="chat-message__artifacts" aria-label="Artifacts">
                  {message.artifacts.map((artifact) => (
                    <ArtifactCard artifact={artifact} key={artifact.id} />
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="chat-window__empty">
            <Sparkles size={20} aria-hidden="true" />
            <h2>{chatEnabled ? 'Ready when you are.' : 'Connect MiniMax to start chatting.'}</h2>
            <p>{chatEnabled ? 'Ask Bubbles to plan, research, create an agent, or remember a preference.' : 'Setup keeps chat disabled until the MiniMax API is ready.'}</p>
          </div>
        )}
      </div>
      <form className="chat-composer" aria-label="Message composer" onSubmit={onSubmit}>
        <textarea
          aria-label="Message Bubbles"
          className="chat-composer__input"
          disabled={!chatEnabled}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={chatEnabled ? 'Message Bubbles' : 'Connect MiniMax first'}
          rows={2}
          value={draft}
        />
        <div className="chat-composer__footer">
          <span>{chatEnabled ? 'Bubbles will route this through the active agent.' : 'MiniMax setup is required before sending.'}</span>
          <button type="submit" className="send-button" aria-label="Send message" disabled={!chatEnabled}>
            <Send size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}

function ArtifactCard({ artifact }: { artifact: NonNullable<ChatMessage['artifacts']>[number] }) {
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (artifact.kind === 'image' && artifact.path) {
    async function handleDownload() {
      if (!artifact.path || downloadStatus === 'saving') {
        return;
      }

      setDownloadStatus('saving');
      const result = await window.bubbles?.capabilities?.downloadArtifact?.({
        path: artifact.path,
        title: artifact.title
      });
      setDownloadStatus(result?.ok ? 'saved' : 'error');
    }

    return (
      <figure className="artifact-card artifact-card--image">
        <img alt="Generated image artifact" src={artifact.url ?? toArtifactUrl(artifact.path)} />
        <figcaption>
          <span>{artifact.title ?? 'Generated image'}</span>
          <button
            aria-label="Download generated image"
            className="artifact-card__download"
            disabled={downloadStatus === 'saving'}
            onClick={() => void handleDownload()}
            type="button"
          >
            <Download size={14} aria-hidden="true" />
            <span>{downloadStatus === 'saving' ? 'Saving' : 'Download'}</span>
          </button>
        </figcaption>
        {downloadStatus === 'saved' ? <small className="artifact-card__status">Saved to Downloads.</small> : null}
        {downloadStatus === 'error' ? <small className="artifact-card__status artifact-card__status--error">Download failed.</small> : null}
      </figure>
    );
  }

  if (artifact.kind === 'audio' && artifact.path) {
    return (
      <div className="artifact-card artifact-card--audio">
        <audio aria-label="Generated music artifact" controls src={artifact.url ?? toArtifactUrl(artifact.path)} />
        <span>{artifact.title ?? 'Generated music'}</span>
      </div>
    );
  }

  if (artifact.kind === 'site' && artifact.url) {
    return (
      <a className="artifact-card artifact-card--site" href={artifact.url} rel="noreferrer" target="_blank" aria-label="Open generated site">
        <span>{artifact.title ?? 'Generated site'}</span>
        <small>{artifact.url}</small>
      </a>
    );
  }

  return null;
}

function toArtifactUrl(path: string) {
  if (/^[a-z]+:\/\//i.test(path)) {
    return path;
  }

  return `bubbles-artifact://local/${encodeURIComponent(path)}`;
}
