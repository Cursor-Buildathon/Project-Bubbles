import { app, BrowserWindow, ipcMain, net, protocol, screen, shell } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertWorkflowCommandsAllowed,
  createAgentBirthService,
  createAgentRegistry,
  createApprovalService,
  createCalendarConnector,
  createConnectorRegistry,
  createEmailConnector,
  createFlowRouter,
  createInitialVoiceSessionState,
  createLandingPageRunner,
  createMemoryExtractor,
  createMcpClient,
  createMiniMaxCreativeService,
  createStaticSiteServer,
  findAvailablePort,
  createVoiceApprovalResolver,
  createWebSearchConnector,
  GOOGLE_CALENDAR_MCP_CONFIG,
  GOOGLE_GMAIL_MCP_CONFIG,
  createSecureKeyStore,
  createSqliteMemoryStore,
  createSqliteTimelineStore,
  createTraceEvent,
  generateMiniMaxJson,
  parseExplicitRememberCommand,
  redactSecrets,
  type AgentBirthDraft,
  type AgentProfile,
  type ApprovalRequest,
  type ArtifactMetadata,
  type CliEvent,
  type ConnectorConfig,
  type ConnectorHealth,
  type MemoryItem,
  type MemoryStore,
  type McpLaunchConfig,
  type MiniMaxSetupService,
  type SetupStatus,
  type TimelineEvent,
  type TimelineStore,
  type TraceFieldValue,
  type VoiceEvent,
  type VoiceSessionState
} from '@bubbles/core';
import { registerApprovalIpc } from './ipc/approvalIpc.js';
import { createApprovalVoiceIpcController, registerApprovalVoiceIpc } from './ipc/approvalVoiceIpc.js';
import { registerCapabilityIpc } from './ipc/capabilityIpc.js';
import { createConnectorUpdateFeatureGate, registerConnectorIpc } from './ipc/connectorIpc.js';
import { createProcessRunner, registerSetupIpc } from './ipc/setupIpc.js';
import { createNativeSpeechPlayback } from './ipc/speechPlayback.js';
import { registerTaskIpc, type TaskIpcController } from './ipc/taskIpc.js';
import { createVoiceIpcController, registerVoiceIpc } from './ipc/voiceIpc.js';
import { sendToWindow } from './ipc/windowMessaging.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'bubbles-artifact',
    privileges: {
      secure: true,
      standard: true,
      stream: true,
      supportFetchAPI: true
    }
  }
]);

let avatarWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let setupService: MiniMaxSetupService | undefined;
let taskController: TaskIpcController | undefined;
let agentRegistry: ReturnType<typeof createAgentRegistry> | undefined;
let approvalService: Awaited<ReturnType<typeof createApprovalService>> | undefined;
let connectorRegistry: Awaited<ReturnType<typeof createConnectorRegistry>> | undefined;
let memoryStore: MemoryStore | undefined;
let timelineStore: TimelineStore | undefined;
let generalKeyStore: ReturnType<typeof createSecureKeyStore> | undefined;
let connectorMcpClient: ReturnType<typeof createMcpClient> | undefined;
let taskLogDir = '';
let artifactRoot = '';
const pendingAgentDrafts = new Map<string, AgentBirthDraft>();
const pendingConnectorActions = new Map<
  string,
  { connectorId: 'calendar'; event: { endsAt: string; startsAt: string; title: string; attendees?: string[]; timezone?: string } } | { connectorId: 'email'; draftId: string }
>();
const pendingLandingPageActions = new Map<string, { request: string }>();
const staticSiteServers: Array<{ stop: () => void }> = [];
const voiceTraceIds = new Map<string, string>();
const voiceEnabled = process.env.BUBBLES_VOICE_ENABLED !== 'false';
const voiceApprovalsEnabled = voiceEnabled && process.env.BUBBLES_VOICE_APPROVALS_ENABLED !== 'false';
const gmailRealEnabled = process.env.BUBBLES_CONNECTORS_GMAIL_REAL !== 'false';
const calendarRealEnabled = process.env.BUBBLES_CONNECTORS_CALENDAR_REAL !== 'false';
const creativeImageEnabled = process.env.BUBBLES_CREATIVE_IMAGE !== 'false';
const creativeMusicEnabled = process.env.BUBBLES_CREATIVE_MUSIC !== 'false';
const landingPageEnabled = process.env.BUBBLES_CODING_LANDING_PAGE !== 'false';
const minimaxMediaFixture = process.env.BUBBLES_MINIMAX_MEDIA_FIXTURE !== 'false';

type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'waiting_approval'
  | 'confused'
  | 'concerned'
  | 'celebrating'
  | 'sleeping';

interface ChatMessage {
  id: number;
  author: 'user' | 'bubbles';
  artifacts?: ArtifactMetadata[];
  citations?: Array<{ title: string; url: string; snippet?: string }>;
  text: string;
}

interface AppState {
  activeTaskId: string | null;
  activeAgent: AgentProfile | null;
  approvals: ApprovalRequest[];
  avatarState: AvatarState;
  availableAgents: AgentProfile[];
  connectors: ConnectorConfig[];
  messages: ChatMessage[];
  recentMemories: MemoryItem[];
  taskEvents: CliEvent[];
  timelineEvents: TimelineEvent[];
  voiceState: VoiceSessionState;
}

const appState: AppState = {
  activeTaskId: null,
  activeAgent: null,
  approvals: [],
  avatarState: 'idle',
  availableAgents: [],
  connectors: [],
  messages: [
    {
      id: 1,
      author: 'bubbles',
      text: 'Hi, I am Bubbles. Click me when you want the full workspace.'
    }
  ],
  recentMemories: [],
  taskEvents: [],
  timelineEvents: [],
  voiceState: createInitialVoiceSessionState({ enabled: voiceEnabled })
};

const compactBounds = {
  width: 340,
  height: 390
};

const panelBounds = {
  width: 1120,
  height: 760
};

function keepAvatarAbovePanel() {
  if (!avatarWindow || avatarWindow.isDestroyed()) {
    return;
  }

  avatarWindow.setAlwaysOnTop(true, 'screen-saver');
  avatarWindow.moveTop();
}

function createWindow() {
  avatarWindow = new BrowserWindow({
    width: compactBounds.width,
    height: compactBounds.height,
    minWidth: compactBounds.width,
    minHeight: compactBounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    show: false,
    title: 'Bubbles',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  avatarWindow.setAlwaysOnTop(true, 'screen-saver');
  avatarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  avatarWindow.setFullScreenable(false);

  avatarWindow.once('ready-to-show', () => {
    avatarWindow?.show();
  });

  avatarWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  loadRenderer(avatarWindow, 'avatar');
}

function createPanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.focus();
    keepAvatarAbovePanel();
    return panelWindow;
  }

  const fallbackArea = screen.getPrimaryDisplay().workArea;
  const avatarBounds = avatarWindow?.getBounds() ?? {
    x: fallbackArea.x + fallbackArea.width - compactBounds.width - 24,
    y: fallbackArea.y + fallbackArea.height - compactBounds.height - 24,
    width: compactBounds.width,
    height: compactBounds.height
  };
  const display = screen.getDisplayMatching(avatarBounds);
  const x = Math.max(display.workArea.x, avatarBounds.x - panelBounds.width + 24);
  const y = Math.max(display.workArea.y, avatarBounds.y - panelBounds.height + compactBounds.height);

  panelWindow = new BrowserWindow({
    x,
    y,
    width: panelBounds.width,
    height: panelBounds.height,
    minWidth: 760,
    minHeight: 560,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    show: false,
    title: 'Bubbles Workspace',
    backgroundColor: '#f9fbfa',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  panelWindow.setAlwaysOnTop(true, 'floating');
  panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  panelWindow.once('ready-to-show', () => {
    panelWindow?.show();
    keepAvatarAbovePanel();
  });

  panelWindow.on('focus', keepAvatarAbovePanel);

  panelWindow.on('closed', () => {
    panelWindow = null;
    sendToWindow(avatarWindow, 'panel:state', false);
  });

  panelWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  loadRenderer(panelWindow, 'panel');
  return panelWindow;
}

function loadRenderer(window: BrowserWindow, windowRole: 'avatar' | 'panel') {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?window=${windowRole}`);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: {
        window: windowRole
      }
    });
  }
}

void app.whenReady().then(() => {
  app.setAppUserModelId('com.bubbles.mvp');
  registerWindowIpc();
  const speechPlayback = createNativeSpeechPlayback();
  registerVoiceIpc(
    ipcMain,
    createVoiceIpcController({
      enabled: voiceEnabled,
      publish: handleVoiceEvent,
      speakText: async (input) => {
        appendTraceEvent('tts.speak_requested', {
          ttsId: input.ttsId,
          fields: { textLength: input.text.length }
        });
        const result = await speechPlayback.speak(input);
        appendTraceEvent(result.ok ? 'tts.speak_completed' : 'tts.speak_failed', {
          ttsId: result.ttsId,
          fields: {
            error: result.error,
            ok: result.ok
          }
        });
        return result;
      },
      stopSpeaking: (input) => {
        const result = speechPlayback.stop(input);
        appendTraceEvent('tts.stop_requested', {
          ttsId: result.ttsId,
          fields: { ok: result.ok }
        });
        return result;
      }
    })
  );
  const runCommand = createProcessRunner();
  connectorMcpClient = createMcpClient({
    fetch: async (url, init) => {
      const response = await globalThis.fetch(url, init);
      return {
        ok: response.ok,
        status: response.status,
        text: () => response.text()
      };
    },
    runCommand
  });
  generalKeyStore = createSecureKeyStore({ runCommand });
  setupService = registerSetupIpc({ keyStore: generalKeyStore, onStatusChange: broadcastSetupStatus });
  const minimaxCliPrefix = join(app.getPath('userData'), 'tools', 'mmx-cli');
  const projectRoot = resolveProjectRoot();
  agentRegistry = createAgentRegistry({ agentsRoot: join(projectRoot, 'agents') });
  void hydrateAgentState();
  void hydrateMemoryState().then(initializeSafetyIpc);
  taskLogDir = join(app.getPath('userData'), 'task-logs');
  artifactRoot = join(app.getPath('userData'), 'artifacts');
  registerLogIpc();
  registerArtifactProtocol();
  registerCapabilityIpc({ artifactRoot });
  taskController = registerTaskIpc({
    logDir: taskLogDir,
    minimaxCliPrefix,
    getActiveAgentId: () => appState.activeAgent?.id ?? 'general-assistant',
    getMemoryContext: (_userText, activeAgentId) =>
      memoryStore?.query({ agentId: activeAgentId, limit: 8 }) ?? Promise.resolve([]),
    onTaskEvent: handleTaskEvent,
    onTaskStarted: handleTaskStarted,
    preflight: preflightMiniMaxCli
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function registerWindowIpc() {
  ipcMain.handle('app:get-state', () => appState);

  ipcMain.handle('app:set-avatar-state', (_event, avatarState: AvatarState) => {
    appState.avatarState = avatarState;
    broadcastAppState();
    return appState;
  });

  ipcMain.handle('app:send-message', async (_event, userText: string) => {
    const trimmedText = userText.trim();

    if (!trimmedText) {
      return appState;
    }

    if (await handleRememberCommand(trimmedText)) {
      return appState;
    }

    if (await handleConnectorSetupCommand(trimmedText)) {
      return appState;
    }

    const routed = await routeCapabilityFlow(trimmedText);

    if (routed) {
      return appState;
    }

    await taskController?.startTask(trimmedText);
    void extractMemoriesFromMessage(trimmedText);
    broadcastAppState();
    return appState;
  });

  ipcMain.handle('agents:list', async () => {
    await hydrateAgentState();
    return appState.availableAgents;
  });

  ipcMain.handle('agents:activate', async (_event, agentId: string) => {
    appState.activeAgent = (await agentRegistry?.activate(agentId)) ?? appState.activeAgent;
    await timelineStore?.append({
      type: 'agent_activated',
      title: 'Agent activated',
      summary: `${appState.activeAgent?.name ?? agentId} is now active.`,
      agentId
    });
    await hydrateAgentState();
    await hydrateMemoryState();
    broadcastAppState();
    return appState;
  });

  ipcMain.handle('agents:preview-birth', async (_event, request: string) => {
    const apiKey = await generalKeyStore?.getGeneralApiKey();

    if (!apiKey) {
      throw new Error('MiniMax General API key is required before agent birth.');
    }

    const service = createAgentBirthService({
      generateJson: (prompt) => generateMiniMaxJson(apiKey, prompt)
    });
    return service.preview(request);
  });

  ipcMain.handle('agents:create-from-preview', async (_event, draft: AgentBirthDraft) => {
    await hydrateApprovalState();

    if (!approvalService) {
      throw new Error('Approval service is unavailable.');
    }

    const approval = await approvalService.create({
      taskId: `task-agent-${Date.now()}`,
      agentId: appState.activeAgent?.id ?? 'general-assistant',
      actionType: 'agent_file_create',
      title: `Create ${draft.profile.name}`,
      explanation: 'Bubbles needs approval before writing new agent files.',
      preview: {
        agent: draft.profile,
        skillsMarkdown: draft.skillsMarkdown
      }
    });
    pendingAgentDrafts.set(approval.id, draft);
    appState.approvals = await approvalService.list();
    appState.avatarState = 'waiting_approval';
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: `I drafted ${draft.profile.name}. Please approve the agent file creation before I write it.`
      }
    ];
    broadcastAppState();
    return draft.profile;
  });

  ipcMain.handle('agents:create-approved-draft', async (_event, draft: AgentBirthDraft) => {
    const agent = await agentRegistry?.create(draft);

    if (agent) {
      appState.activeAgent = agent;
      await timelineStore?.append({
        type: 'agent_created',
        title: 'Agent created',
        summary: `${agent.name} was created.`,
        agentId: agent.id,
        metadata: { skillsPath: agent.skillsPath }
      });
    }

    await hydrateAgentState();
    await hydrateMemoryState();
    broadcastAppState();
    return agent;
  });

  ipcMain.handle('memory:list', async () => {
    await hydrateMemoryState();
    return appState.recentMemories;
  });

  ipcMain.handle('memory:timeline', async () => {
    await hydrateMemoryState();
    return appState.timelineEvents;
  });

  ipcMain.handle('memory:clear', async () => {
    await memoryStore?.deleteAll();
    await timelineStore?.append({
      type: 'memory_cleared',
      title: 'Memory cleared',
      summary: 'All saved memories were cleared.'
    });
    await hydrateMemoryState();
    broadcastAppState();
    return appState;
  });

  ipcMain.handle('panel:toggle', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.close();
      panelWindow = null;
      sendToWindow(avatarWindow, 'panel:state', false);
      return { isOpen: false };
    }

    createPanelWindow();
    sendToWindow(avatarWindow, 'panel:state', true);
    keepAvatarAbovePanel();
    return { isOpen: true };
  });

  ipcMain.handle('panel:close', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.close();
      panelWindow = null;
    }

    sendToWindow(avatarWindow, 'panel:state', false);
    return { isOpen: false };
  });

  ipcMain.handle('window:move-by', (event, delta: { x: number; y: number }) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? avatarWindow;

    if (!window) {
      return;
    }

    const [x, y] = window.getPosition();
    window.setPosition(Math.round(x + delta.x), Math.round(y + delta.y));

    if (window === panelWindow) {
      keepAvatarAbovePanel();
    }
  });
}

function registerLogIpc() {
  ipcMain.handle('logs:export-redacted', async () => {
    await mkdir(taskLogDir, { recursive: true });
    await shell.openPath(taskLogDir);
    return { path: taskLogDir };
  });
}

function appendTraceEvent(
  name: string,
  input: {
    approvalId?: string;
    fields?: Record<string, TraceFieldValue>;
    taskId?: string;
    traceId?: string;
    ttsId?: string;
    voiceTurnId?: string;
  } = {}
) {
  if (!taskLogDir) {
    return;
  }

  const event = createTraceEvent({
    approvalId: input.approvalId,
    fields: input.fields,
    name,
    taskId: input.taskId,
    traceId: input.traceId,
    ttsId: input.ttsId,
    voiceTurnId: input.voiceTurnId
  });
  const logPath = join(taskLogDir, 'observability.ndjson');
  void mkdir(taskLogDir, { recursive: true })
    .then(() => appendFile(logPath, `${JSON.stringify(event)}\n`, 'utf8'))
    .catch(() => undefined);
}

function registerArtifactProtocol() {
  if (protocol.isProtocolHandled('bubbles-artifact')) {
    return;
  }

  protocol.handle('bubbles-artifact', (request) => {
    const url = new URL(request.url);
    const target = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const root = resolveArtifactRoot();
    const resolvedRoot = resolve(root);
    const resolvedTarget = resolve(target);

    if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}/`)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(resolvedTarget).toString());
  });
}

function broadcastAppState() {
  sendToWindow(avatarWindow, 'app:state', appState);
  sendToWindow(panelWindow, 'app:state', appState);
}

function handleVoiceEvent(event: VoiceEvent, voiceState: VoiceSessionState) {
  appState.voiceState = voiceState;
  const traceId = event.type === 'voice.session_started' ? event.traceId : voiceTraceIds.get(event.voiceTurnId ?? '');

  if (event.type === 'voice.session_started') {
    voiceTraceIds.set(event.voiceTurnId, event.traceId);
  }

  appendTraceEvent(event.type, {
    traceId,
    voiceTurnId: 'voiceTurnId' in event ? event.voiceTurnId : undefined,
    fields: createVoiceTraceFields(event, voiceState)
  });

  sendToWindow(avatarWindow, 'voice:event', event, voiceState);
  sendToWindow(panelWindow, 'voice:event', event, voiceState);
  broadcastAppState();
}

function createVoiceTraceFields(event: VoiceEvent, voiceState: VoiceSessionState): Record<string, TraceFieldValue> {
  const base: Record<string, TraceFieldValue> = {
    provider: voiceState.provider,
    sessionStatus: voiceState.status
  };

  if (event.type === 'voice.final') {
    return {
      ...base,
      affect: event.affect?.primary,
      confidence: event.confidence,
      textLength: event.text.length
    };
  }

  if (event.type === 'voice.partial') {
    return {
      ...base,
      confidence: event.confidence,
      textLength: event.text.length
    };
  }

  if (event.type === 'voice.error') {
    return {
      ...base,
      error: event.error,
      provider: event.provider
    };
  }

  if (event.type === 'voice.barge_in') {
    return {
      ...base,
      stoppedTtsId: event.stoppedTtsId
    };
  }

  return base;
}

function broadcastSetupStatus(status: SetupStatus) {
  sendToWindow(avatarWindow, 'setup:status', status);
  sendToWindow(panelWindow, 'setup:status', status);
}

async function hydrateAgentState() {
  if (!agentRegistry) {
    return;
  }

  await agentRegistry.initialize();
  appState.availableAgents = await agentRegistry.list();
  appState.activeAgent = await agentRegistry.getActive();
  broadcastAppState();
}

async function hydrateMemoryState() {
  if (!memoryStore || !timelineStore) {
    const databaseDir = join(app.getPath('userData'), 'data');
    memoryStore ??= await createSqliteMemoryStore({ databasePath: join(databaseDir, 'memory.sqlite') });
    timelineStore ??= await createSqliteTimelineStore({ databasePath: join(databaseDir, 'timeline.sqlite') });
  }

  appState.recentMemories = (await memoryStore?.query({ limit: 8 })) ?? [];
  appState.timelineEvents = (await timelineStore?.list(12)) ?? [];
}

async function initializeSafetyIpc() {
  await hydrateApprovalState();
  await hydrateConnectorState();

  if (approvalService) {
    registerApprovalIpc({
      approvalService,
      onApprovalResolved: handleApprovalResolved,
      onChanged: async () => {
        await hydrateApprovalState();
        await hydrateMemoryState();
        broadcastAppState();
      }
    });
    registerApprovalVoiceIpc(
      ipcMain,
      createApprovalVoiceIpcController({
        resolver: createVoiceApprovalResolver({
          approvalService,
          enabled: voiceApprovalsEnabled
        }),
        onApprovalResolved: handleApprovalResolved
      })
    );
  }

  if (connectorRegistry) {
    registerConnectorIpc({
      checkHealth: checkConnectorHealth,
      connectorRegistry,
      normalizeUpdate: createConnectorUpdateFeatureGate({
        calendarRealEnabled,
        gmailRealEnabled
      }),
      onChanged: async () => {
        await hydrateConnectorState();
        broadcastAppState();
      }
    });
  }
}

async function hydrateApprovalState() {
  await hydrateMemoryState();
  const databaseDir = join(app.getPath('userData'), 'data');
  approvalService ??= await createApprovalService({
    databasePath: join(databaseDir, 'approvals.sqlite'),
    memoryStore,
    timelineStore
  });
  appState.approvals = await approvalService.list();
}

async function hydrateConnectorState() {
  const databaseDir = join(app.getPath('userData'), 'data');
  connectorRegistry ??= await createConnectorRegistry({ databasePath: join(databaseDir, 'connectors.sqlite') });
  appState.connectors = await connectorRegistry.list();
}

async function routeCapabilityFlow(userText: string) {
  await hydrateApprovalState();
  await hydrateConnectorState();

  const router = createFlowRouter({
    connectors: {
      calendar: createCalendarConnector({ mcpClient: createRuntimeMcpClient() }),
      email: createEmailConnector({ mcpClient: createRuntimeMcpClient() }),
      get: (id) => connectorRegistry?.get(id) ?? Promise.resolve(undefined),
      webSearch: createWebSearchConnector({ mcpClient: createRuntimeMcpClient() })
    },
    creative: {
      run: (request) => runCreativeCapability(request)
    },
    createApproval: async (approval) => {
      if (!approvalService) {
        throw new Error('Approval service is unavailable.');
      }

      const created = await approvalService.create(approval);
      rememberConnectorAction(created);
      rememberLandingPageAction(created);
      return created;
    }
  });
  const result = await router.route({
    activeAgentId: appState.activeAgent?.id ?? 'general-assistant',
    userText
  });

  if (!result.handled) {
    return false;
  }

  appState.messages = [
    ...appState.messages,
    { id: Date.now(), author: 'user', text: userText },
    { id: Date.now() + 1, author: 'bubbles', artifacts: result.artifacts, citations: result.citations, text: result.message }
  ];
  appState.avatarState = result.avatarState;
  appState.approvals = (await approvalService?.list()) ?? appState.approvals;
  await hydrateMemoryState();
  broadcastAppState();
  return true;
}

async function runCreativeCapability(request: { kind: 'image' | 'music'; prompt: string }) {
  const enabled = request.kind === 'image' ? creativeImageEnabled : creativeMusicEnabled;

  if (!enabled) {
    return { ok: false as const, error: `${request.kind === 'image' ? 'Image' : 'Music'} generation is disabled.` };
  }

  const service = createMiniMaxCreativeService({
    runCommand: createProcessRunner()
  });
  return service.run({
    artifactDir: join(resolveArtifactRoot(), `${request.kind}-${Date.now()}`),
    fixture: minimaxMediaFixture,
    kind: request.kind,
    prompt: request.prompt
  });
}

function resolveArtifactRoot() {
  if (!artifactRoot) {
    artifactRoot = join(app.getPath('userData'), 'artifacts');
  }

  return artifactRoot;
}

function createRuntimeMcpClient() {
  return {
    call: (config: McpLaunchConfig, method: string, params: Record<string, unknown>) =>
      connectorMcpClient?.call(resolveMcpToken(config), method, params) ??
      Promise.resolve({ ok: false as const, error: 'MCP client is unavailable.' })
  };
}

function resolveMcpToken(config: McpLaunchConfig): McpLaunchConfig {
  if (!config.httpUrl || config.accessToken) {
    return config;
  }

  const matchingConnector = appState.connectors.find((connector) => connector.launchConfig.httpUrl === config.httpUrl);
  const accessTokenEnv = matchingConnector?.launchConfig.oauth?.accessTokenEnv;
  const accessToken = accessTokenEnv ? process.env[accessTokenEnv] : undefined;
  return {
    ...config,
    accessToken
  };
}

function rememberConnectorAction(approval: ApprovalRequest) {
  if (approval.actionType === 'send_email') {
    const draftId = stringPreviewValue(approval.preview.draftId);

    if (draftId) {
      pendingConnectorActions.set(approval.id, { connectorId: 'email', draftId });
    }
  }

  if (approval.actionType === 'calendar_update') {
    const newEvent = approval.preview.newEvent;

    if (newEvent && typeof newEvent === 'object' && !Array.isArray(newEvent)) {
      const event = newEvent as Record<string, unknown>;
      const title = stringPreviewValue(event.title);
      const startsAt = stringPreviewValue(event.startsAt);
      const endsAt = stringPreviewValue(event.endsAt);

      if (title && startsAt && endsAt) {
        pendingConnectorActions.set(approval.id, {
          connectorId: 'calendar',
          event: {
            attendees: arrayOfStrings(event.attendees),
            endsAt,
            startsAt,
            timezone: stringPreviewValue(event.timezone),
            title
          }
        });
      }
    }
  }
}

function rememberLandingPageAction(approval: ApprovalRequest) {
  if (approval.actionType !== 'shell_command' || approval.title !== 'Generate landing page') {
    return;
  }

  const request = stringPreviewValue(approval.preview.request);

  if (request) {
    pendingLandingPageActions.set(approval.id, { request });
  }
}

async function runApprovedConnectorAction(approval: ApprovalRequest) {
  const pendingAction = pendingConnectorActions.get(approval.id);

  if (!pendingAction || !connectorRegistry) {
    return false;
  }

  pendingConnectorActions.delete(approval.id);
  const config = await connectorRegistry.get(pendingAction.connectorId);

  if (!config) {
    appState.messages = [...appState.messages, { id: Date.now() + 1, author: 'bubbles', text: 'The connector is no longer available.' }];
    return true;
  }

  if (pendingAction.connectorId === 'email') {
    const connector = createEmailConnector({ mcpClient: createRuntimeMcpClient() });
    const result = await connector.sendDraft(config, pendingAction.draftId);
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: result.ok ? 'Approved. I sent the email draft.' : result.error
      }
    ];
    return true;
  }

  const connector = createCalendarConnector({ mcpClient: createRuntimeMcpClient() });
  const result = await connector.createEvent(config, pendingAction.event);
  appState.messages = [
    ...appState.messages,
    {
      id: Date.now() + 1,
      author: 'bubbles',
      text: result.ok ? `Approved. I created ${result.event.title} on your calendar.` : result.error
    }
  ];
  return true;
}

async function runApprovedLandingPageAction(approval: ApprovalRequest) {
  const traceId = `trace-c7-${approval.id}`;
  const pendingAction = pendingLandingPageActions.get(approval.id) ?? {
    request: stringPreviewValue(approval.preview.request) ?? ''
  };

  if (!pendingAction.request) {
    return false;
  }

  pendingLandingPageActions.delete(approval.id);

  if (!landingPageEnabled) {
    appState.messages = [...appState.messages, { id: Date.now() + 1, author: 'bubbles', text: 'Landing-page generation is disabled.' }];
    return true;
  }

  try {
    assertWorkflowCommandsAllowed([
      { command: 'node', args: ['scripts/accessibility-check.mjs'] },
      { command: 'vite', args: ['build'] }
    ]);
    const sandboxRoot = join(resolveArtifactRoot(), 'landing-pages');
    const runner = createLandingPageRunner({ sandboxRoot });
    const generated = await runner.generate({ request: pendingAction.request });
    appendTraceEvent('c7.sandbox_generated', {
      approvalId: approval.id,
      taskId: approval.taskId,
      traceId,
      fields: {
        artifactId: generated.ok ? generated.artifact.id : undefined,
        ok: generated.ok,
        requestLength: pendingAction.request.length
      }
    });

    if (!generated.ok) {
      appState.messages = [
        ...appState.messages,
        { id: Date.now() + 1, author: 'bubbles', text: `The landing-page sandbox failed checks: ${generated.error}` }
      ];
      return true;
    }

    appendTraceEvent('c7.command_started', {
      approvalId: approval.id,
      taskId: approval.taskId,
      traceId,
      fields: { command: 'node scripts/accessibility-check.mjs' }
    });
    const accessibility = await runCommandInDirectory('node', ['scripts/accessibility-check.mjs'], generated.siteDir);
    appendTraceEvent('c7.command_completed', {
      approvalId: approval.id,
      taskId: approval.taskId,
      traceId,
      fields: { command: 'node scripts/accessibility-check.mjs', exitCode: accessibility.exitCode }
    });

    if (accessibility.exitCode !== 0) {
      appState.messages = [
        ...appState.messages,
        { id: Date.now() + 1, author: 'bubbles', text: `The landing-page accessibility check failed: ${redactSecrets(accessibility.stderr || accessibility.stdout)}` }
      ];
      return true;
    }

    const viteBin = resolveViteBin();
    appendTraceEvent('c7.command_started', {
      approvalId: approval.id,
      taskId: approval.taskId,
      traceId,
      fields: { command: 'node vite build' }
    });
    const build = await runCommandInDirectory('node', [viteBin, 'build'], generated.siteDir);
    appendTraceEvent('c7.command_completed', {
      approvalId: approval.id,
      taskId: approval.taskId,
      traceId,
      fields: { command: 'node vite build', exitCode: build.exitCode }
    });

    if (build.exitCode !== 0) {
      appState.messages = [
        ...appState.messages,
        { id: Date.now() + 1, author: 'bubbles', text: `The landing-page build failed: ${redactSecrets(build.stderr || build.stdout)}` }
      ];
      return true;
    }

    const port = await findAvailablePort(4173, { host: '127.0.0.1' });
    const server = createStaticSiteServer(generated.siteDir);
    const served = await server.start(port);
    staticSiteServers.push(server);
    await shell.openExternal(served.url);
    appendTraceEvent('c7.site_served', {
      approvalId: approval.id,
      taskId: approval.taskId,
      traceId,
      fields: {
        artifactId: generated.artifact.id,
        port,
        url: served.url
      }
    });
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        artifacts: [{ ...generated.artifact, url: served.url }],
        text: 'I opened the landing page locally. Take a look, and tell me what to change.'
      }
    ];
    return true;
  } catch (error) {
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: `The landing-page sandbox failed: ${redactSecrets(error)}`
      }
    ];
    return true;
  }
}

function runCommandInDirectory(command: string, args: string[], cwd: string) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolvePromise) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      resolvePromise({ stdout: '', stderr: redactSecrets(error), exitCode: 1 });
    });
    child.on('close', (exitCode) => {
      resolvePromise({ stdout, stderr, exitCode: exitCode ?? 1 });
    });
  });
}

function stringPreviewValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function checkConnectorHealth(connector: ConnectorConfig): ConnectorHealth {
  if (!connector.enabled) {
    return {
      authStatus: 'not_configured',
      healthStatus: 'unhealthy',
      lastError: 'Connector is disabled.'
    };
  }

  if (connector.mode === 'fixture') {
    return {
      authStatus: 'ready',
      healthStatus: 'healthy'
    };
  }

  if (connector.launchConfig.httpUrl && connector.launchConfig.oauth) {
    const tokenEnv = connector.launchConfig.oauth.accessTokenEnv;

    if (!tokenEnv || !process.env[tokenEnv]) {
      return {
        authStatus: 'needs_auth',
        healthStatus: 'unhealthy',
        lastError: 'OAuth token is not available. Complete the Google Workspace MCP auth flow or use fixture mode.'
      };
    }

    return {
      authStatus: 'ready',
      healthStatus: 'healthy'
    };
  }

  if (connector.launchConfig.command) {
    return {
      authStatus: 'ready',
      healthStatus: 'healthy'
    };
  }

  return {
    authStatus: 'not_configured',
    healthStatus: 'unhealthy',
    lastError: 'Connector is not configured yet.'
  };
}

async function handleApprovalResolved(approval: ApprovalRequest) {
  appendTraceEvent('approval.resolved', {
    approvalId: approval.id,
    taskId: approval.taskId,
    fields: {
      actionType: approval.actionType,
      risk: approval.risk,
      status: approval.status
    }
  });

  if (approval.status !== 'approved') {
    await hydrateApprovalState();
    await hydrateMemoryState();
    appState.avatarState = 'idle';
    broadcastAppState();
    return;
  }

  const agentDraft = pendingAgentDrafts.get(approval.id);

  if (agentDraft && agentRegistry) {
    const agent = await agentRegistry.create(agentDraft);
    pendingAgentDrafts.delete(approval.id);
    appState.activeAgent = agent;
    await timelineStore?.append({
      type: 'agent_created',
      title: 'Agent created',
      summary: `${agent.name} was created after approval.`,
      agentId: agent.id,
      metadata: { skillsPath: agent.skillsPath, approvalId: approval.id }
    });
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: `${agent.name} is created and ready.`
      }
    ];
  }

  await runApprovedConnectorAction(approval);
  await runApprovedLandingPageAction(approval);

  await hydrateAgentState();
  await hydrateApprovalState();
  await hydrateMemoryState();
  appState.avatarState = 'celebrating';
  broadcastAppState();
}

async function handleRememberCommand(userText: string) {
  const content = parseExplicitRememberCommand(userText);

  if (!content) {
    return false;
  }

  await hydrateMemoryState();

  if (!memoryStore || !timelineStore) {
    return false;
  }

  const memory = await memoryStore.create({
    type: 'user_preference',
    content,
    agentId: appState.activeAgent?.id,
    tags: ['explicit'],
    importance: 4
  });
  await timelineStore.append({
    type: 'memory_created',
    title: 'Memory saved',
    summary: memory.content,
    agentId: appState.activeAgent?.id,
    memoryId: memory.id
  });
  appState.messages = [
    ...appState.messages,
    { id: Date.now(), author: 'user', text: redactSecrets(userText) },
    { id: Date.now() + 1, author: 'bubbles', text: `I'll remember: ${memory.content}` }
  ];
  appState.avatarState = 'celebrating';
  await hydrateMemoryState();
  broadcastAppState();
  return true;
}

async function handleConnectorSetupCommand(userText: string) {
  const text = userText.toLowerCase();

  if (!/\b(connect|setup|set up|enable|use)\b/.test(text) || !/\b(gmail|email|calendar|web search|search)\b/.test(text)) {
    return false;
  }

  await hydrateConnectorState();

  if (!connectorRegistry) {
    return false;
  }

  if (/\b(gmail|email)\b/.test(text)) {
    await connectorRegistry.update('email', connectorSetupUpdate('email', /\bfixture\b/.test(text)));
    await hydrateConnectorState();
    appendConnectorSetupMessage(
      userText,
      /\bfixture\b/.test(text)
        ? 'Email fixture mode is ready for Gmail read and reply approval tests.'
        : 'Gmail setup is staged with gmail.readonly, gmail.compose, and gmail.send. Complete OAuth, or switch to fixture mode for CI.'
    );
    return true;
  }

  if (/\bcalendar\b/.test(text)) {
    await connectorRegistry.update('calendar', connectorSetupUpdate('calendar', /\bfixture\b/.test(text)));
    await hydrateConnectorState();
    appendConnectorSetupMessage(
      userText,
      /\bfixture\b/.test(text)
        ? 'Calendar fixture mode is ready for approval-gated scheduling tests.'
        : 'Calendar setup is staged with calendar.events.owned plus read/freebusy scopes. Complete OAuth, or switch to fixture mode for CI.'
    );
    return true;
  }

  await connectorRegistry.update('web-search', connectorSetupUpdate('web-search', true));
  await hydrateConnectorState();
  appendConnectorSetupMessage(userText, 'Web Search fixture mode is ready and will return cited research results.');
  return true;
}

function connectorSetupUpdate(
  connectorId: 'calendar' | 'email' | 'web-search',
  fixture: boolean
): Partial<ConnectorConfig> {
  if (fixture || connectorId === 'web-search') {
    return {
      allowedAgents: connectorId === 'web-search' ? ['research-agent'] : ['email-calendar-assistant'],
      authStatus: 'ready',
      enabled: true,
      healthStatus: 'healthy',
      mode: 'fixture',
      requiredApproval: 'preview_sensitive_actions'
    };
  }

  if ((connectorId === 'email' && !gmailRealEnabled) || (connectorId === 'calendar' && !calendarRealEnabled)) {
    return connectorSetupUpdate(connectorId, true);
  }

  const setup = connectorId === 'email' ? GOOGLE_GMAIL_MCP_CONFIG : GOOGLE_CALENDAR_MCP_CONFIG;
  return {
    allowedAgents: ['email-calendar-assistant'],
    authStatus: 'needs_auth',
    enabled: true,
    healthStatus: 'unhealthy',
    launchConfig: {
      httpUrl: setup.httpUrl,
      oauth: {
        provider: 'google-workspace',
        scopes: [...setup.scopes]
      }
    },
    mode: 'real',
    requiredApproval: 'preview_sensitive_actions'
  };
}

function appendConnectorSetupMessage(userText: string, message: string) {
  appState.messages = [
    ...appState.messages,
    { id: Date.now(), author: 'user', text: redactSecrets(userText) },
    { id: Date.now() + 1, author: 'bubbles', text: message }
  ];
  appState.avatarState = 'working';
  broadcastAppState();
}

async function extractMemoriesFromMessage(userText: string) {
  if (!memoryStore || !timelineStore || !generalKeyStore) {
    return;
  }

  const status = await setupService?.getStatus();

  if (status?.state !== 'ready') {
    return;
  }

  const apiKey = await generalKeyStore.getGeneralApiKey();

  if (!apiKey) {
    return;
  }

  const extractor = createMemoryExtractor({
    generateJson: (prompt) => generateMiniMaxJson(apiKey, prompt)
  });
  const memories = await extractor.extract({
    activeAgentId: appState.activeAgent?.id ?? 'general-assistant',
    userText
  });

  for (const memoryInput of memories) {
    const memory = await memoryStore.create(memoryInput);
    await timelineStore.append({
      type: 'memory_created',
      title: 'Memory saved',
      summary: memory.content,
      agentId: memory.agentId,
      memoryId: memory.id
    });
  }

  if (memories.length) {
    await hydrateMemoryState();
    broadcastAppState();
  }
}

function handleTaskStarted(userText: string, taskId: string) {
  appState.activeTaskId = taskId;
  appendTraceEvent('task.started', {
    taskId,
    fields: {
      activeAgentId: appState.activeAgent?.id,
      textLength: userText.length
    }
  });
  appState.messages = [
    ...appState.messages,
    {
      id: Date.now(),
      author: 'user',
      text: userText
    }
  ];
  appState.avatarState = 'thinking';
  void timelineStore?.append({
    type: 'task_started',
    title: 'Task started',
    summary: userText,
    taskId,
    agentId: appState.activeAgent?.id
  }).then(() => hydrateMemoryState());
  broadcastAppState();
}

function handleTaskEvent(event: CliEvent, avatarState: AvatarState) {
  appState.taskEvents = [...appState.taskEvents, event];
  appState.avatarState = avatarState;
  appendTraceEvent(event.type, {
    taskId: event.taskId,
    fields: {
      avatarState,
      payloadKeys: Object.keys(event.payload)
    }
  });

  if (event.type === 'task.result' || event.type === 'task.error' || event.type === 'task.cancelled') {
    appState.activeTaskId = null;
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: formatTaskMessage(event)
      }
    ];
    void persistFinalTaskEvent(event);
  }

  if (event.type === 'task.error' && isMiniMaxHealthFailure(event)) {
    void setupService?.markCliUnhealthy(formatTaskError(event)).then(broadcastSetupStatus);
  }

  broadcastAppState();
  sendToWindow(avatarWindow, 'tasks:event', event);
  sendToWindow(panelWindow, 'tasks:event', event);
}

async function persistFinalTaskEvent(event: CliEvent) {
  const text = formatTaskMessage(event);
  const eventType =
    event.type === 'task.result' ? 'task_completed' : event.type === 'task.cancelled' ? 'task_cancelled' : 'task_failed';

  const summary = await memoryStore?.create({
    type: 'task_summary',
    content: text,
    sourceTaskId: event.taskId,
    agentId: appState.activeAgent?.id,
    tags: ['task'],
    importance: event.type === 'task.result' ? 3 : 2
  });
  await timelineStore?.append({
    type: eventType,
    title: event.type === 'task.result' ? 'Task completed' : event.type === 'task.cancelled' ? 'Task cancelled' : 'Task failed',
    summary: text,
    taskId: event.taskId,
    agentId: appState.activeAgent?.id,
    memoryId: summary?.id,
    metadata: event.payload
  });
  await hydrateMemoryState();
  broadcastAppState();
}

function formatTaskMessage(event: CliEvent) {
  if (event.type === 'task.result') {
    return stringPayload(event.payload.text) ?? 'Done. I finished that task.';
  }

  if (event.type === 'task.cancelled') {
    return 'I cancelled that task.';
  }

  return `I hit a CLI error: ${formatTaskError(event)}`;
}

async function preflightMiniMaxCli() {
  const qaDelayMs = Number(process.env.BUBBLES_QA_TASK_DELAY_MS ?? 0);
  if (Number.isFinite(qaDelayMs) && qaDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, qaDelayMs));
  }

  let status = await setupService?.getStatus();

  if (!status) {
    return { ok: true as const };
  }

  broadcastSetupStatus(status);

  if (status.state === 'ready') {
    return { ok: true as const };
  }

  status = await setupService?.retry();

  if (!status) {
    return { ok: true as const };
  }

  broadcastSetupStatus(status);

  if (status.state === 'ready') {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    category: categorizeSetupFailure(status),
    error: status.cli.error ?? status.tokenPlan.error ?? status.generalApi.error ?? 'MiniMax CLI is not ready. Use Recheck CLI in Settings.',
    hint: status.cli.error ? undefined : 'Open Settings and use Recheck CLI after checking your network or key setup.'
  };
}

function formatTaskError(event: CliEvent) {
  return (
    stringPayload(event.payload.errorMessage) ??
    stringPayload(event.payload.error) ??
    stringPayload(event.payload.rawMessage) ??
    stringPayload(event.payload.reason) ??
    'I hit a CLI error while working on that task.'
  );
}

function isMiniMaxHealthFailure(event: CliEvent) {
  return event.payload.category === 'network' || event.payload.category === 'auth' || event.payload.category === 'quota';
}

function categorizeSetupFailure(status: SetupStatus) {
  const text = `${status.cli.error ?? ''} ${status.tokenPlan.error ?? ''} ${status.generalApi.error ?? ''}`;

  if (/network|connection|proxy|timeout/i.test(text)) {
    return 'network';
  }

  if (/auth|token|api key|401|403/i.test(text)) {
    return 'auth';
  }

  if (/quota|limit|429/i.test(text)) {
    return 'quota';
  }

  return 'unknown';
}

function stringPayload(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function resolveProjectRoot() {
  const candidates = [resolve(app.getAppPath(), '../..'), resolve(process.cwd()), resolve(process.cwd(), '../..')];

  return candidates.find((candidate) => existsSync(join(candidate, 'agents', 'general-assistant', 'agent.json'))) ?? process.cwd();
}

function resolveViteBin() {
  const projectRoot = resolveProjectRoot();
  const candidates = [
    join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    join(projectRoot, 'apps', 'desktop', 'node_modules', 'vite', 'bin', 'vite.js')
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  for (const server of staticSiteServers) {
    server.stop();
  }
  staticSiteServers.length = 0;
});
