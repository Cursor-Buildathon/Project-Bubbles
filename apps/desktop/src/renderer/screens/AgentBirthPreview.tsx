import { FormEvent, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { type AgentBirthDraft, type AgentProfile } from '@bubbles/core';

interface AgentBirthPreviewProps {
  onCreate: (draft: AgentBirthDraft) => Promise<AgentProfile>;
  onPreview: (request: string) => Promise<AgentBirthDraft>;
}

export function AgentBirthPreview({ onCreate, onPreview }: AgentBirthPreviewProps) {
  const [request, setRequest] = useState('');
  const [draft, setDraft] = useState<AgentBirthDraft | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!request.trim()) {
      return;
    }

    try {
      setStatus('Generating preview...');
      const nextDraft = await onPreview(request.trim());
      setDraft(nextDraft);
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Agent preview failed.');
    }
  }

  async function handleCreate() {
    if (!draft) {
      return;
    }

    try {
      setStatus('Creating agent...');
      await onCreate(draft);
      setRequest('');
      setDraft(null);
      setStatus('Agent created.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Agent creation failed.');
    }
  }

  return (
    <section className="agent-birth" data-testid="agent-birth" aria-label="Agent birth">
      <h2>
        <Sparkles size={16} aria-hidden="true" />
        Agent birth
      </h2>
      <form className="agent-birth__form" onSubmit={handlePreview}>
        <input
          aria-label="Agent request"
          onChange={(event) => setRequest(event.target.value)}
          placeholder="Create a coding agent for this project"
          value={request}
        />
        <button type="submit">Preview agent</button>
      </form>
      {status ? <p className="micro-status">{status}</p> : null}
      {draft ? (
        <div className="agent-birth__preview">
          <strong>{draft.profile.name}</strong>
          <p>{draft.profile.role}</p>
          <code>{draft.profile.skillsPath}</code>
          <pre>{draft.agentMarkdown}</pre>
          <pre>{draft.skillsMarkdown}</pre>
          <button type="button" onClick={handleCreate}>
            Create approved agent
          </button>
        </div>
      ) : null}
    </section>
  );
}
