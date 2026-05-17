import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from './App';
import { type ApprovalRequest, type SetupStatus, type VoiceEvent, type VoiceSessionState } from '@bubbles/core';

const bubblesIntroductionResponse =
  "I'm Bubbles. I can plan, remember context, research with Tavily, create images, music, and video, build approved landing pages, create agents, manage approvals, and speak with voice.";

describe('Bubbles floating avatar shell', () => {
  it('renders the assistant workspace without the buildathon demo strip', async () => {
    const previousBubbles = window.bubbles;

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          activeAgent: {
            id: 'general-assistant',
            name: 'General Assistant',
            role: 'Planning',
            badgeName: 'Bubbles',
            voiceStyle: 'warm',
            allowedTools: [],
            memoryRules: [],
            safetyRules: [],
            responseStyle: 'short',
            skillsPath: 'agents/general-assistant/skills.md',
            createdAt: '2026-05-14T10:00:00.000Z',
            updatedAt: '2026-05-14T10:00:00.000Z'
          },
          avatarState: 'idle',
          connectors: [
            {
              id: 'tavily-research',
              name: 'Tavily Research',
              type: 'tavily_research',
              enabled: true,
              mode: 'real',
              authStatus: 'ready',
              healthStatus: 'healthy',
              allowedAgents: ['general-assistant'],
              requiredApproval: 'none',
              launchConfig: { maxResults: 8, remoteUrl: 'https://mcp.tavily.com/mcp/', searchDepth: 'advanced' },
              updatedAt: '2026-05-14T10:00:00.000Z'
            }
          ],
          messages: [],
          recentMemories: [],
          taskEvents: []
        }),
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' }))
      });

      render(<App />);

      expect(await screen.findByTestId('assistant-panel')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-shell')).toBeInTheDocument();
      expect(screen.getByTestId('conversation-rail')).toBeInTheDocument();
      expect(screen.getByTestId('chat-surface')).toBeInTheDocument();
      expect(screen.getByTestId('workspace-status-rail')).toBeInTheDocument();
      expect(screen.queryByTestId('demo-mode-panel')).not.toBeInTheDocument();
      expect(screen.queryByText('Real integrations visible')).not.toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('keeps setup reset and utility actions visible in the workspace settings', async () => {
    const previousBubbles = window.bubbles;

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' }))
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText('Recheck MiniMax')).not.toBeNull();
        expect(screen.queryByText('Reset Token Plan key')).not.toBeNull();
        expect(screen.queryByText('Reset all')).not.toBeNull();
        expect(screen.queryByText('Export redacted logs')).not.toBeNull();
      });
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('labels Tavily connector issues and degraded MiniMax state in the workspace status', async () => {
    const previousBubbles = window.bubbles;

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          avatarState: 'idle',
          connectors: [
            {
              id: 'tavily-research',
              name: 'Tavily Research',
              type: 'tavily_research',
              enabled: false,
              mode: 'real',
              authStatus: 'needs_auth',
              healthStatus: 'unhealthy',
              allowedAgents: ['general-assistant'],
              requiredApproval: 'none',
              launchConfig: { maxResults: 8, remoteUrl: 'https://mcp.tavily.com/mcp/', searchDepth: 'advanced' },
              lastError: 'Tavily key is missing',
              updatedAt: '2026-05-14T10:00:00.000Z'
            }
          ],
          messages: [],
          recentMemories: [],
          taskEvents: []
        }),
        setup: createSetupApi(
          createSetupStatus({
            state: 'setup_error',
            mode: 'not_configured',
            tokenPlan: { present: true, verified: false, error: 'Network unavailable' }
          })
        )
      });

      render(<App />);

      expect(await screen.findByTestId('integration-status-bar')).toHaveTextContent('MiniMax needs attention');
      expect(await screen.findAllByText(/Tavily key is missing/)).not.toHaveLength(0);
      expect(screen.queryByText(/fixture/)).not.toBeInTheDocument();
      expect(screen.getByText(/Add a Tavily API key, enable Tavily Research, and recheck the connector/)).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('keeps avatar developer controls behind a details surface', async () => {
    const previousBubbles = window.bubbles;

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' }))
      });

      render(<App />);

      expect(await screen.findByText('Developer controls')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'thinking' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Developer controls'));

      expect(screen.getByRole('button', { name: 'thinking' })).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('renders compact floating avatar mode by default', () => {
    render(<App />);

    expect(screen.getByTestId('speech-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('floating-avatar-window')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Bubbles assistant panel' })).toBeInTheDocument();
    expect(screen.getByTestId('active-agent-badge')).toHaveTextContent('Bubbles');
    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
  });

  it('keeps long floating speech bubble text in a scrollable focusable region', async () => {
    const previousBubbles = window.bubbles;
    const longBubbleText = [
      'Here is the longer update you asked for:',
      'I found the relevant files, checked the current state, and I can keep the compact bubble readable even when the answer is much longer than the usual greeting.',
      'https://example.com/a/very/long/path/that/should/not-break-the-floating-avatar-bubble-layout'
    ].join('\n');

    try {
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [{ id: 1, author: 'bubbles', text: longBubbleText }],
          taskEvents: []
        })
      });

      render(<App />);

      const speechBubble = await screen.findByRole('region', { name: 'Latest Bubbles message' });

      await waitFor(() => expect(speechBubble.textContent).toBe(longBubbleText));
      expect(speechBubble).toHaveAttribute('tabindex', '0');
      expect(speechBubble).toHaveClass('speech-bubble');
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('shows the latest full ready text in the compact speech bubble instead of a stale voice caption', async () => {
    const previousBubbles = window.bubbles;
    const readyText = 'The webpage is ready. I opened the local preview and added the link in chat.';

    try {
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'celebrating',
          messages: [
            { id: 1, author: 'bubbles', text: 'Previous response.' },
            {
              id: 2,
              author: 'bubbles',
              artifacts: [{ id: 'site-ready-1', kind: 'site' as const, url: 'http://localhost:4173', title: 'Landing page' }],
              speakOnArrival: true,
              text: readyText,
              voiceText: 'The webpage is ready.'
            }
          ],
          taskEvents: [],
          voiceState: createVoiceState({ status: 'idle', captionText: 'Previous response.' })
        }),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState({ status: 'idle', captionText: 'Previous response.' })),
          onEvent: vi.fn(() => () => undefined),
          startSession: vi.fn(),
          stopSession: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      const speechBubble = await screen.findByRole('region', { name: 'Latest Bubbles message' });

      await waitFor(() => expect(speechBubble.textContent).toBe(readyText));
      expect(speechBubble).not.toHaveTextContent('Previous response.');
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('opens the assistant panel with chat, history, task, approvals, memory, connector, and settings sections', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Bubbles assistant panel' }));

    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-history')).toBeInTheDocument();
    expect(screen.getByTestId('active-chat')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-birth')).not.toBeInTheDocument();
    expect(screen.getByTestId('task-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('approval-panel')).toBeInTheDocument();
    expect(screen.getByText('No pending approvals.')).toBeInTheDocument();
    expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    expect(screen.getByTestId('connector-panel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    expect(screen.getByLabelText('Message Bubbles')).toBeInTheDocument();
  });

  it('opens the assistant panel when the speech bubble surface is clicked', () => {
    render(<App />);

    fireEvent.pointerDown(screen.getByTestId('speech-bubble'), { screenX: 100, screenY: 100 });
    fireEvent.pointerUp(screen.getByTestId('speech-bubble'), { screenX: 100, screenY: 100 });

    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
  });

  it('does not drag or toggle the avatar window when pointer moves inside the speech bubble', async () => {
    const previousBubbles = window.bubbles;
    const moveWindowBy = vi.fn().mockResolvedValue(undefined);
    const togglePanel = vi.fn().mockResolvedValue({ isOpen: true });

    try {
      window.bubbles = createPanelBubbles({
        moveWindowBy,
        togglePanel
      });

      render(<App />);
      await act(async () => {
        await Promise.resolve();
      });

      const speechBubble = screen.getByTestId('speech-bubble');

      fireEvent(speechBubble, createPointerTestEvent('pointerdown', 100, 100));
      fireEvent(speechBubble, createPointerTestEvent('pointermove', 100, 130));
      fireEvent(speechBubble, createPointerTestEvent('pointerup', 100, 130));

      expect(moveWindowBy).not.toHaveBeenCalled();
      expect(togglePanel).not.toHaveBeenCalled();
      expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
    } finally {
      window.bubbles = previousBubbles;
    }
  });

  it('closes the assistant panel and returns to compact mode', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Bubbles assistant panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close assistant panel' }));

    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-avatar-window')).toBeInTheDocument();
  });

  it('toggles the assistant panel closed when Bubbles is clicked again', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Bubbles assistant panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Bubbles assistant panel' }));

    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
  });

  it('echoes typed messages in the assistant panel and liquid speech bubble', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Bubbles assistant panel' }));
    fireEvent.change(screen.getByLabelText('Message Bubbles'), { target: { value: 'hello bubbles' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(screen.getByText('hello bubbles')).toBeInTheDocument();
    expect(screen.getAllByText('I heard: hello bubbles')).toHaveLength(2);
    expect(screen.getByTestId('speech-bubble')).toHaveTextContent('I heard: hello bubbles');
  });

  it('changes the visible pet mood from the assistant panel dev controls', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Bubbles assistant panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Developer controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'thinking' }));

    expect(screen.getByLabelText('Bubbles avatar thinking')).toBeInTheDocument();
  });

  it('keeps celebrating active until another mood is selected', () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Bubbles assistant panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Developer controls' }));
    fireEvent.click(screen.getByRole('button', { name: 'celebrating' }));

    expect(screen.getByLabelText('Bubbles avatar celebrating')).toBeInTheDocument();

    vi.advanceTimersByTime(3000);

    expect(screen.getByLabelText('Bubbles avatar celebrating')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('moves the workspace window when the assistant header is dragged', () => {
    const previousBubbles = window.bubbles;
    const moveWindowBy = vi.fn().mockResolvedValue(undefined);

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = {
        closePanel: vi.fn().mockResolvedValue({ isOpen: false }),
        getState: vi.fn().mockReturnValue(new Promise(() => undefined)),
        moveWindowBy,
        onPanelStateChange: vi.fn(() => () => undefined),
        onStateChange: vi.fn(() => () => undefined),
        platform: 'darwin',
        phase: 'phase-2',
        sendMessage: vi.fn().mockResolvedValue({
          avatarState: 'listening',
          messages: []
        }),
        setAvatarState: vi.fn().mockResolvedValue({
          avatarState: 'idle',
          messages: []
        }),
        setup: {
          ...createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
          getStatus: vi.fn().mockReturnValue(new Promise(() => undefined))
        },
        togglePanel: vi.fn().mockResolvedValue({ isOpen: true })
      };

      render(<App />);

      const dragHandle = screen.getByTestId('assistant-panel-drag-handle');
      fireEvent(dragHandle, createPointerTestEvent('pointerdown', 40, 50));
      fireEvent(dragHandle, createPointerTestEvent('pointermove', 72, 68));
      fireEvent.pointerUp(dragHandle);

      expect(moveWindowBy).toHaveBeenCalledWith({ x: 32, y: 18 });
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('disables chat while MiniMax setup still needs a key', async () => {
    const previousBubbles = window.bubbles;

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = {
        closePanel: vi.fn().mockResolvedValue({ isOpen: false }),
        getState: vi.fn().mockResolvedValue({
          avatarState: 'idle',
          messages: []
        }),
        moveWindowBy: vi.fn().mockResolvedValue(undefined),
        onPanelStateChange: vi.fn(() => () => undefined),
        onStateChange: vi.fn(() => () => undefined),
        platform: 'darwin',
        phase: 'phase-2',
        sendMessage: vi.fn().mockResolvedValue({
          avatarState: 'listening',
          messages: []
        }),
        setAvatarState: vi.fn().mockResolvedValue({
          avatarState: 'idle',
          messages: []
        }),
        setup: createSetupApi(createSetupStatus({ state: 'needs_token_plan_key' })),
        togglePanel: vi.fn().mockResolvedValue({ isOpen: true })
      };

      render(<App />);

      expect(await screen.findByLabelText('MiniMax Token Plan key')).toBeInTheDocument();
      expect(screen.getByLabelText('Message Bubbles')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('updates Settings when setup health is marked unhealthy after a task failure', async () => {
    const previousBubbles = window.bubbles;
    let setupStatusCallback: ((status: SetupStatus) => void) | undefined;

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = {
        closePanel: vi.fn().mockResolvedValue({ isOpen: false }),
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        moveWindowBy: vi.fn().mockResolvedValue(undefined),
        onPanelStateChange: vi.fn(() => () => undefined),
        onStateChange: vi.fn(() => () => undefined),
        platform: 'darwin',
        phase: 'phase-3',
        sendMessage: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        setAvatarState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        setup: {
          ...createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
          onStatusChange: vi.fn((callback) => {
            setupStatusCallback = callback;
            return () => undefined;
          })
        },
        tasks: {
          cancel: vi.fn().mockResolvedValue(false),
          getEvents: vi.fn().mockResolvedValue([]),
          onEvent: vi.fn(() => () => undefined),
          start: vi.fn().mockResolvedValue({ taskId: 'task-1' })
        },
        togglePanel: vi.fn().mockResolvedValue({ isOpen: true })
      };

      render(<App />);

      expect(await screen.findAllByText('MiniMax ready')).not.toHaveLength(0);

      act(() => {
        setupStatusCallback?.(
          createSetupStatus({
            state: 'setup_error',
            mode: 'not_configured',
            tokenPlan: {
              present: true,
              verified: false,
              error: 'MiniMax API cannot reach the network right now. Check your connection or proxy settings, then recheck MiniMax.'
            }
          })
        );
      });

      expect(screen.getByText('Setup needs attention')).toBeInTheDocument();
      expect(screen.queryByText('MiniMax ready')).not.toBeInTheDocument();
      expect(screen.getByText(/MiniMax API cannot reach the network right now/)).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('shows the task result text in chat when a task succeeds', async () => {
    const previousBubbles = window.bubbles;
    let stateCallback: ((state: NonNullable<typeof window.bubbles> extends { onStateChange: (callback: infer C) => unknown } ? C extends (state: infer S) => unknown ? S : never : never) => void) | undefined;

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = {
        closePanel: vi.fn().mockResolvedValue({ isOpen: false }),
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        moveWindowBy: vi.fn().mockResolvedValue(undefined),
        onPanelStateChange: vi.fn(() => () => undefined),
        onStateChange: vi.fn((callback) => {
          stateCallback = callback;
          return () => undefined;
        }),
        platform: 'darwin',
        phase: 'phase-3',
        sendMessage: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        setAvatarState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        tasks: {
          cancel: vi.fn().mockResolvedValue(false),
          getEvents: vi.fn().mockResolvedValue([]),
          onEvent: vi.fn(() => () => undefined),
          start: vi.fn().mockResolvedValue({ taskId: 'task-1' })
        },
        togglePanel: vi.fn().mockResolvedValue({ isOpen: true })
      };

      render(<App />);
      await waitFor(() => expect(stateCallback).toBeDefined());

      act(() => {
        stateCallback?.({
          activeTaskId: null,
          avatarState: 'celebrating',
          messages: [{ id: 1, author: 'bubbles', text: 'Hi! How can I help you today?' }],
          taskEvents: []
        });
      });

      expect(await screen.findByText('Hi! How can I help you today?')).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('submits panel chat through the shared app message path in Phase 3', async () => {
    const previousBubbles = window.bubbles;
    const sendMessage = vi.fn().mockResolvedValue({
      activeTaskId: 'task-1',
      avatarState: 'thinking',
      messages: [{ id: 1, author: 'user', text: 'Summarize Phase 3' }],
      taskEvents: []
    });
    const taskStart = vi.fn().mockResolvedValue({ taskId: 'task-1' });

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = {
        closePanel: vi.fn().mockResolvedValue({ isOpen: false }),
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        moveWindowBy: vi.fn().mockResolvedValue(undefined),
        onPanelStateChange: vi.fn(() => () => undefined),
        onStateChange: vi.fn(() => () => undefined),
        platform: 'darwin',
        phase: 'phase-3',
        sendMessage,
        setAvatarState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        tasks: {
          cancel: vi.fn().mockResolvedValue(false),
          getEvents: vi.fn().mockResolvedValue([]),
          onEvent: vi.fn(() => () => undefined),
          start: taskStart
        },
        togglePanel: vi.fn().mockResolvedValue({ isOpen: true })
      };

      render(<App />);

      fireEvent.change(await screen.findByLabelText('Message Bubbles'), { target: { value: 'Summarize Phase 3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('Summarize Phase 3'));
      expect(taskStart).not.toHaveBeenCalled();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('shows a chat error when the shared message path rejects', async () => {
    const previousBubbles = window.bubbles;
    const sendMessage = vi.fn().mockRejectedValue(new Error('Agent creation failed'));

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = {
        closePanel: vi.fn().mockResolvedValue({ isOpen: false }),
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        moveWindowBy: vi.fn().mockResolvedValue(undefined),
        onPanelStateChange: vi.fn(() => () => undefined),
        onStateChange: vi.fn(() => () => undefined),
        platform: 'darwin',
        phase: 'phase-3',
        sendMessage,
        setAvatarState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: []
        }),
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        tasks: {
          cancel: vi.fn().mockResolvedValue(false),
          getEvents: vi.fn().mockResolvedValue([]),
          onEvent: vi.fn(() => () => undefined),
          start: vi.fn()
        },
        togglePanel: vi.fn().mockResolvedValue({ isOpen: true })
      };

      render(<App />);

      fireEvent.change(await screen.findByLabelText('Message Bubbles'), { target: { value: 'create a QA agent' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      expect(await screen.findByText('create a QA agent')).toBeInTheDocument();
      expect(await screen.findByText('I could not start that request: Agent creation failed')).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('submits voice final transcripts through the shared app message path', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const sendMessage = vi.fn().mockResolvedValue({
      activeTaskId: null,
      avatarState: 'idle',
      messages: [
        { id: 1, author: 'user', text: 'Help me plan my day.' },
        { id: 2, author: 'bubbles', text: 'I heard: Help me plan my day.' }
      ],
      taskEvents: [],
      voiceState: createVoiceState({ status: 'speaking', captionText: 'I heard: Help me plan my day.' })
    });
    const startSession = vi.fn().mockResolvedValue({
      event: { type: 'voice.session_started', voiceTurnId: 'voice-1', traceId: 'trace-1' },
      state: createVoiceState({ status: 'listening', activeTurnId: 'voice-1' })
    });

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: [],
          voiceState: createVoiceState()
        }),
        sendMessage,
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        voice: {
          bargeIn: vi.fn().mockResolvedValue({
            event: { type: 'voice.barge_in', voiceTurnId: 'voice-1' },
            state: createVoiceState({ status: 'listening' })
          }),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          startSession,
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      expect(await screen.findByRole('button', { name: /Start voice input/ })).toBeInTheDocument();

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'Help me plan my day.', confidence: 0.92 },
          createVoiceState({ status: 'processing', captionText: 'Help me plan my day.' })
        );
      });

      await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('Help me plan my day.'));
      expect(await screen.findAllByText('I heard: Help me plan my day.')).toHaveLength(2);
      expect(screen.getByRole('status', { name: 'Voice caption' })).toHaveTextContent('I heard: Help me plan my day.');
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('ignores an older voice sendMessage result when a newer request has already resolved', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    type SendMessageResult = Awaited<ReturnType<NonNullable<typeof window.bubbles>['sendMessage']>>;
    const olderResponse = createDeferred<SendMessageResult>();
    const newerResponse = createDeferred<SendMessageResult>();
    const sendMessage = vi.fn((text: string) => (text === 'older request' ? olderResponse.promise : newerResponse.promise));
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: [],
          voiceState: createVoiceState()
        }),
        sendMessage,
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      expect(await screen.findByRole('button', { name: /Start voice input/ })).toBeInTheDocument();
      await waitFor(() => expect(voiceCallback).toBeDefined());

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-old', text: 'older request', confidence: 0.9 },
          createVoiceState({ status: 'processing', captionText: 'older request' })
        );
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-new', text: 'newer request', confidence: 0.9 },
          createVoiceState({ status: 'processing', captionText: 'newer request' })
        );
      });

      newerResponse.resolve({
        activeTaskId: null,
        avatarState: 'celebrating',
        messages: [
          { id: 3, author: 'user', text: 'newer request' },
          { id: 4, author: 'bubbles', text: 'Newer answer.' }
        ],
        taskEvents: [],
        voiceState: createVoiceState({ status: 'speaking', captionText: 'Newer answer.' })
      });

      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'Newer answer.', ttsId: 'tts-current' }));
      expect(await screen.findByText('Newer answer.')).toBeInTheDocument();

      olderResponse.resolve({
        activeTaskId: null,
        avatarState: 'celebrating',
        messages: [
          { id: 1, author: 'user', text: 'older request' },
          { id: 2, author: 'bubbles', text: 'Older answer.' }
        ],
        taskEvents: [],
        voiceState: createVoiceState({ status: 'speaking', captionText: 'Older answer.' })
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.queryByText('Older answer.')).not.toBeInTheDocument();
      expect(speak).not.toHaveBeenCalledWith({ text: 'Older answer.', ttsId: 'tts-current' });
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it.each([
    {
      artifact: { id: 'voice-image-ready', kind: 'image' as const, path: '/tmp/bubbles-image.png', title: 'Generated image' },
      command: 'create an image',
      label: 'image',
      progressText: "I'm generating your image. This can take a minute.",
      readyText: 'The image is ready.',
      visibleText: 'The image is ready. I added it to the chat.'
    },
    {
      artifact: { id: 'voice-music-ready', kind: 'audio' as const, path: '/tmp/bubbles-song.mp3', title: 'Generated music' },
      command: 'create music',
      label: 'music',
      progressText: "I'm generating your music. This can take a minute or two.",
      readyText: 'The music is ready.',
      visibleText: 'The music is ready. I added it to the chat.'
    },
    {
      artifact: { id: 'voice-site-ready', kind: 'site' as const, url: 'http://localhost:4173', title: 'Landing page' },
      command: 'create a web landing page',
      label: 'web landing page',
      progressText: "Approved. I'm generating the landing page now.",
      readyText: 'The webpage is ready.',
      visibleText: 'The webpage is ready. I opened the local preview and added the link in chat.'
    }
  ])('speaks the ready $label output from a voice request without replaying old or progress text', async ({ artifact, command, progressText, readyText, visibleText }) => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    let stateCallback: Parameters<NonNullable<typeof window.bubbles>['onStateChange']>[0] | undefined;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });
    const sendMessage = vi.fn().mockResolvedValue({
      activeTaskId: 'task-voice-output',
      avatarState: 'thinking',
      messages: [
        { id: 1, author: 'bubbles', text: 'Previous response.' },
        { id: 2, author: 'user', text: command },
        { id: 3, author: 'bubbles', text: progressText }
      ],
      taskEvents: [],
      voiceState: createVoiceState({ status: 'processing', captionText: progressText })
    });
    window.sessionStorage.clear();

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [{ id: 1, author: 'bubbles', text: 'Previous response.' }],
          taskEvents: [],
          voiceState: createVoiceState()
        }),
        onStateChange: vi.fn((callback) => {
          stateCallback = callback;
          return () => undefined;
        }),
        sendMessage,
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      expect(await screen.findByRole('button', { name: /Start voice input/ })).toBeInTheDocument();
      await waitFor(() => expect(voiceCallback).toBeDefined());
      await waitFor(() => expect(stateCallback).toBeDefined());

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: `voice-${artifact.id}`, text: command, confidence: 0.92 },
          createVoiceState({ status: 'processing', captionText: command })
        );
      });

      await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(command));
      await act(async () => {
        await Promise.resolve();
      });
      expect(speak).not.toHaveBeenCalledWith({ text: 'Previous response.', ttsId: 'tts-current' });
      expect(speak).not.toHaveBeenCalledWith({ text: progressText, ttsId: 'tts-current' });

      act(() => {
        stateCallback?.({
          activeTaskId: null,
          avatarState: 'celebrating',
          messages: [
            { id: 1, author: 'bubbles', text: 'Previous response.' },
            { id: 2, author: 'user', text: command },
            {
              id: 3,
              author: 'bubbles',
              artifacts: [artifact],
              speakOnArrival: true,
              text: visibleText,
              voiceText: readyText
            }
          ],
          taskEvents: [],
          voiceState: createVoiceState({ status: 'speaking', captionText: readyText })
        });
      });

      expect(await screen.findByText(visibleText)).toBeInTheDocument();
      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: readyText, ttsId: 'tts-current' }));
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
      window.sessionStorage.clear();
    }
  });

  it('speaks a new web-search voice summary while keeping the full report in chat', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const reportText = '## Web research report\nI found three relevant sources and added citations in the chat.';
    const voiceText = 'Your web search is ready. I put the full report in chat.';
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current' });
    const sendMessage = vi.fn().mockResolvedValue({
      activeTaskId: null,
      avatarState: 'celebrating',
      messages: [
        { id: 1, author: 'bubbles', text: 'Previous response.' },
        { id: 2, author: 'user', text: 'do a web search' },
        { id: 3, author: 'bubbles', text: reportText, voiceText }
      ],
      taskEvents: [],
      voiceState: createVoiceState({ status: 'speaking', captionText: voiceText })
    });

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [{ id: 1, author: 'bubbles', text: 'Previous response.' }],
          taskEvents: [],
          voiceState: createVoiceState()
        }),
        sendMessage,
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      expect(await screen.findByRole('button', { name: /Start voice input/ })).toBeInTheDocument();
      await waitFor(() => expect(voiceCallback).toBeDefined());

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-web-search', text: 'do a web search', confidence: 0.92 },
          createVoiceState({ status: 'processing', captionText: 'do a web search' })
        );
      });

      await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('do a web search'));
      await waitFor(() => expect(screen.getByTestId('chat-surface')).toHaveTextContent('I found three relevant sources'));
      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: voiceText, ttsId: 'tts-current' }));
      expect(speak).not.toHaveBeenCalledWith({ text: 'Previous response.', ttsId: 'tts-current' });
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('speaks the fixed Bubbles introduction when requested by voice', async () => {
    const previousBubbles = window.bubbles;
    const restoreAudio = mockAudioPlayback();
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const speak = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-current', audioUrl: 'bubbles-artifact://local/intro.mp3' });
    const sendMessage = vi.fn().mockResolvedValue({
      activeTaskId: null,
      avatarState: 'celebrating',
      messages: [
        { id: 1, author: 'user', text: 'Bubbles Introduce Yourself' },
        {
          id: 2,
          author: 'bubbles',
          speakOnArrival: true,
          text: bubblesIntroductionResponse,
          voiceText: bubblesIntroductionResponse
        }
      ],
      taskEvents: [],
      voiceState: createVoiceState({ status: 'speaking', captionText: bubblesIntroductionResponse })
    });

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: [],
          voiceState: createVoiceState()
        }),
        sendMessage,
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        voice: {
          bargeIn: vi.fn().mockResolvedValue({
            event: { type: 'voice.barge_in', voiceTurnId: 'voice-1' },
            state: createVoiceState({ status: 'listening' })
          }),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn().mockResolvedValue(createVoiceState()),
          stopSpeaking: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      expect(await screen.findByRole('button', { name: /Start voice input/ })).toBeInTheDocument();
      await waitFor(() => expect(voiceCallback).toBeDefined());

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-intro', text: 'Bubbles Introduce Yourself', confidence: 0.94 },
          createVoiceState({ status: 'processing', captionText: 'Bubbles Introduce Yourself' })
        );
      });

      await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('Bubbles Introduce Yourself'));
      expect(await screen.findAllByText(bubblesIntroductionResponse)).toHaveLength(2);
      expect(screen.getByRole('status', { name: 'Voice caption' })).toHaveTextContent(bubblesIntroductionResponse);
      await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: bubblesIntroductionResponse, ttsId: 'tts-current' }));
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
      restoreAudio();
    }
  });

  it('resolves pending approvals from voice final transcripts instead of sending chat', async () => {
    const previousBubbles = window.bubbles;
    let voiceCallback: ((event: VoiceEvent, state: VoiceSessionState) => void) | undefined;
    const sendMessage = vi.fn();
    const resolveApproval = vi.fn().mockResolvedValue({
      decision: {
        approvalId: 'approval-1',
        voiceTurnId: 'voice-1',
        decision: 'approved',
        transcript: 'approve'
      },
      message: 'External data send was approved.',
      fallbackRequired: false,
      attemptCount: 0
    });
    const getState = vi
      .fn()
      .mockResolvedValueOnce({
        activeTaskId: null,
        approvals: [
          {
            id: 'approval-1',
            taskId: 'task-1',
            agentId: 'general-assistant',
            actionType: 'external_data_send',
            risk: 'high',
            title: 'Send external data',
            explanation: 'Review before sending.',
            preview: { to: 'alex@example.com' },
            status: 'pending',
            createdAt: '2026-05-15T00:00:00.000Z'
          }
        ],
        avatarState: 'waiting_approval',
        messages: [],
        taskEvents: [],
        voiceState: createVoiceState()
      })
      .mockResolvedValue({
        activeTaskId: null,
        approvals: [],
        avatarState: 'idle',
        messages: [{ id: 1, author: 'bubbles', text: 'External data send was approved.' }],
        taskEvents: [],
        voiceState: createVoiceState({ status: 'idle', captionText: 'External data send was approved.' })
      });

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState,
        sendMessage,
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn((callback) => {
            voiceCallback = callback;
            return () => undefined;
          }),
          resolveApproval,
          startSession: vi.fn().mockResolvedValue({
            event: { type: 'voice.session_started', voiceTurnId: 'voice-1', traceId: 'trace-1' },
            state: createVoiceState({ status: 'listening', activeTurnId: 'voice-1' })
          }),
          stopSession: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      expect(await screen.findByText('Send external data')).toBeInTheDocument();

      await act(async () => {
        voiceCallback?.(
          { type: 'voice.final', voiceTurnId: 'voice-1', text: 'approve', confidence: 0.94 },
          createVoiceState({ status: 'processing', captionText: 'approve' })
        );
      });

      await waitFor(() =>
        expect(resolveApproval).toHaveBeenCalledWith({
          approvalId: 'approval-1',
          voiceTurnId: 'voice-1',
          transcript: 'approve'
        })
      );
      expect(sendMessage).not.toHaveBeenCalled();
      expect(screen.getByRole('status', { name: 'Voice caption' })).toHaveTextContent('External data send was approved.');
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('does not require a voice prompt for typed approval resolution', async () => {
    const previousBubbles = window.bubbles;
    const approval = createApprovalRequest();
    const approve = vi.fn().mockResolvedValue({ ...approval, status: 'approved' });
    const speak = vi.fn().mockResolvedValue({ ok: true, text: 'Approval needed: Send external data.', ttsId: 'tts-current' });
    const getState = vi
      .fn()
      .mockResolvedValueOnce({
        activeTaskId: null,
        approvals: [approval],
        avatarState: 'waiting_approval',
        messages: [{ id: 1, author: 'bubbles', text: 'Please review this approval.' }],
        taskEvents: [],
        voiceState: createVoiceState()
      })
      .mockResolvedValue({
        activeTaskId: null,
        approvals: [],
        avatarState: 'idle',
        messages: [{ id: 1, author: 'bubbles', text: 'Approved. I sent the email draft.' }],
        taskEvents: [],
        voiceState: createVoiceState()
      });

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        approvals: {
          approve,
          cancel: vi.fn(),
          create: vi.fn(),
          deny: vi.fn(),
          list: vi.fn()
        },
        getState,
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState()),
          onEvent: vi.fn(() => () => undefined),
          speak,
          startSession: vi.fn(),
          stopSession: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      expect(await screen.findByText('Send external data')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Voice caption' })).not.toBeInTheDocument();
      expect(speak).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Approve Send external data' }));

      await waitFor(() => expect(approve).toHaveBeenCalledWith('approval-1'));
      expect(screen.getByText('Approved. I sent the email draft.')).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });

  it('keeps typed chat usable when voice is disabled by the feature flag', async () => {
    const previousBubbles = window.bubbles;
    const sendMessage = vi.fn().mockResolvedValue({
      activeTaskId: null,
      avatarState: 'idle',
      messages: [
        { id: 1, author: 'user', text: 'typed fallback still works' },
        { id: 2, author: 'bubbles', text: 'I heard: typed fallback still works' }
      ],
      taskEvents: [],
      voiceState: createVoiceState({ enabled: false })
    });

    try {
      window.history.pushState({}, '', '/?window=panel');
      window.bubbles = createPanelBubbles({
        getState: vi.fn().mockResolvedValue({
          activeTaskId: null,
          avatarState: 'idle',
          messages: [],
          taskEvents: [],
          voiceState: createVoiceState({ enabled: false })
        }),
        sendMessage,
        setup: createSetupApi(createSetupStatus({ state: 'ready', mode: 'full' })),
        voice: {
          bargeIn: vi.fn(),
          getState: vi.fn().mockResolvedValue(createVoiceState({ enabled: false })),
          onEvent: vi.fn(() => () => undefined),
          startSession: vi.fn(),
          stopSession: vi.fn(),
          submitPartialTranscript: vi.fn(),
          submitTranscript: vi.fn()
        }
      });

      render(<App />);

      expect(await screen.findByRole('button', { name: /Start voice input/ })).toBeDisabled();
      fireEvent.change(screen.getByLabelText('Message Bubbles'), { target: { value: 'typed fallback still works' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('typed fallback still works'));
      expect(await screen.findByText('I heard: typed fallback still works')).toBeInTheDocument();
    } finally {
      window.history.pushState({}, '', '/');
      window.bubbles = previousBubbles;
    }
  });
});

function createPointerTestEvent(type: string, screenX: number, screenY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: screenX },
    clientY: { value: screenY },
    pointerId: { value: 1 },
    screenX: { value: screenX },
    screenY: { value: screenY }
  });

  return event;
}

function createSetupApi(status: SetupStatus): NonNullable<typeof window.bubbles>['setup'] {
  return {
    getStatus: vi.fn().mockResolvedValue(status),
    resetAllMiniMax: vi.fn().mockResolvedValue(status),
    resetTokenPlanKey: vi.fn().mockResolvedValue(status),
    retry: vi.fn().mockResolvedValue(status),
    saveTokenPlanKey: vi.fn().mockResolvedValue(status)
  };
}

function createPanelBubbles(
  overrides: Partial<NonNullable<typeof window.bubbles>> = {}
): NonNullable<typeof window.bubbles> {
  return {
    closePanel: vi.fn().mockResolvedValue({ isOpen: false }),
    getState: vi.fn().mockResolvedValue({
      activeTaskId: null,
      avatarState: 'idle',
      messages: [],
      taskEvents: []
    }),
    moveWindowBy: vi.fn().mockResolvedValue(undefined),
    onPanelStateChange: vi.fn(() => () => undefined),
    onStateChange: vi.fn(() => () => undefined),
    platform: 'darwin',
    phase: 'phase-6-8',
    sendMessage: vi.fn().mockResolvedValue({
      avatarState: 'listening',
      messages: []
    }),
    setAvatarState: vi.fn().mockResolvedValue({
      avatarState: 'idle',
      messages: []
    }),
    setup: createSetupApi(createSetupStatus()),
    togglePanel: vi.fn().mockResolvedValue({ isOpen: true }),
    ...overrides
  };
}

function mockAudioPlayback() {
  const previousAudio = window.Audio;

  class FakeAudio {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';

    constructor(src: string) {
      this.src = src;
    }

    pause() {}

    play() {
      return Promise.resolve();
    }
  }

  Object.defineProperty(window, 'Audio', {
    configurable: true,
    value: FakeAudio
  });

  return () => {
    Object.defineProperty(window, 'Audio', {
      configurable: true,
      value: previousAudio
    });
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function createApprovalRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'approval-1',
    taskId: 'task-1',
    agentId: 'general-assistant',
    actionType: 'external_data_send',
    risk: 'high',
    title: 'Send external data',
    explanation: 'Review before sending.',
    preview: { to: 'alex@example.com' },
    status: 'pending',
    createdAt: '2026-05-15T00:00:00.000Z',
    ...overrides
  };
}

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

function createSetupStatus(overrides: Partial<SetupStatus> = {}): SetupStatus {
  return {
    state: 'needs_token_plan_key',
    mode: 'not_configured',
    tokenPlan: { present: false, verified: false },
    updatedAt: '2026-05-14T10:00:00.000Z',
    ...overrides
  };
}
