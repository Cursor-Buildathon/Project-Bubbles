import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ChatSurface } from './ChatSurface';

describe('ChatSurface', () => {
  it('keeps the chat window focused on message history and composer only', () => {
    const onDraftChange = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());

    render(
      <ChatSurface
        chatEnabled
        draft=""
        messages={[
          { id: 1, author: 'bubbles', text: 'Ready when you are.' },
          { id: 2, author: 'user', text: 'Plan the project.' }
        ]}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole('log', { name: 'Chat messages' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Message composer' })).toBeInTheDocument();
    expect(screen.queryByText('Live conversation')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message Bubbles'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onDraftChange).toHaveBeenCalledWith('hello');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows a compact setup hint without replacing the composer', () => {
    render(
      <ChatSurface
        chatEnabled={false}
        draft=""
        messages={[]}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Connect MiniMax to start chatting.')).toBeInTheDocument();
    expect(screen.getByLabelText('Message Bubbles')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('renders research citations under assistant messages', () => {
    render(
      <ChatSurface
        chatEnabled
        draft=""
        messages={[
          {
            id: 1,
            author: 'bubbles',
            text: 'I found 1 source: Workspace MCP.',
            citations: [{ title: 'Workspace MCP', url: 'https://developers.google.com/workspace', snippet: 'Official docs.' }]
          }
        ]}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'Workspace MCP' })).toHaveAttribute('href', 'https://developers.google.com/workspace');
    expect(screen.getByText('Official docs.')).toBeInTheDocument();
  });

  it('renders image, audio, and site artifacts under assistant messages', () => {
    render(
      <ChatSurface
        chatEnabled
        draft=""
        messages={[
          {
            id: 1,
            author: 'bubbles',
            text: 'The artifacts are ready.',
            artifacts: [
              { id: 'image-1', kind: 'image', path: '/tmp/image.svg' },
              { id: 'audio-1', kind: 'audio', path: '/tmp/music.mp3' },
              { id: 'site-1', kind: 'site', url: 'http://127.0.0.1:4173' }
            ]
          }
        ]}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('img', { name: 'Generated image artifact' })).toHaveAttribute(
      'src',
      `bubbles-artifact://local/${encodeURIComponent('/tmp/image.svg')}`
    );
    expect(screen.getByLabelText('Generated music artifact')).toHaveAttribute(
      'src',
      `bubbles-artifact://local/${encodeURIComponent('/tmp/music.mp3')}`
    );
    expect(screen.getByRole('link', { name: 'Open generated site' })).toHaveAttribute('href', 'http://127.0.0.1:4173');
  });
});
