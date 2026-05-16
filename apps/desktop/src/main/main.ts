import { app, BrowserWindow, globalShortcut, ipcMain, net, protocol, screen, session, shell, systemPreferences } from 'electron';
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
  createConnectorRegistry,
  createFlowRouter,
  createInitialVoiceSessionState,
  createLandingPageRunner,
  createMemoryExtractor,
  createMiniMaxCreativeService,
  createMiniMaxLandingPageCodeGenerator,
  createMiniMaxTtsService,
  createRecommendedAgentBirthDraft,
  createAgentBirthTaskEvents,
  createAgentBirthDraftingTaskEvents,
  classifyIntent,
  createResearchService,
  createStaticSiteServer,
  createTavilyRemoteMcpClient,
  createTavilyResearchConnector,
  createTavilySetupService,
  findAvailablePort,
  createVoiceTranscriptionService,
  createVoiceApprovalResolver,
  createSecureKeyStore,
  createSqliteMemoryStore,
  createSqliteTimelineStore,
  createTaskEvent,
  createTraceEvent,
  generateMiniMaxJson,
  generateMiniMaxText,
  isReadResearchPrompt,
  isResearchFollowUp,
  parseExplicitRememberCommand,
  redactSecrets,
  type AgentBirthDraft,
  type AgentProfile,
  type ApprovalRequest,
  type ArtifactMetadata,
  type ConnectorConfig,
  type ConnectorHealth,
  type LandingPageFile,
  type MemoryItem,
  type MemoryStore,
  type MiniMaxSetupService,
  type ResearchReport,
  type SetupStatus,
  type TavilySetupService,
  type TavilySetupStatus,
  type TaskEvent,
  type TaskType,
  type TimelineEvent,
  type TimelineStore,
  type TraceFieldValue,
  type VoiceEvent,
  type VoiceSessionState,
  type VoiceSetupService,
  type VoiceSetupStatus
} from '@bubbles/core';
import { registerApprovalIpc } from './ipc/approvalIpc.js';
import { createApprovalVoiceIpcController, registerApprovalVoiceIpc } from './ipc/approvalVoiceIpc.js';
import { registerCapabilityIpc } from './ipc/capabilityIpc.js';
import { registerConnectorIpc } from './ipc/connectorIpc.js';
import { createProcessRunner, registerSetupIpc } from './ipc/setupIpc.js';
import { registerTavilySetupIpc } from './ipc/tavilySetupIpc.js';
import { registerTaskIpc, type TaskIpcController } from './ipc/taskIpc.js';
import { createVoiceIpcController, registerVoiceIpc } from './ipc/voiceIpc.js';
import { registerVoiceSetupIpc } from './ipc/voiceSetupIpc.js';
import { shouldUseMiniMaxMediaFixture } from './mediaFixtureMode.js';
import { sendToWindow } from './ipc/windowMessaging.js';
import {
  copyManagedLandingPageProject,
  isLandingPageRevisionPrompt,
  readLandingPageProjectFiles
} from './landingPageWorkflow.js';
import { registerVoiceShortcut, unregisterVoiceShortcut, VOICE_SHORTCUT_CHANNEL } from './voiceShortcut.js';

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
let voiceSetupService: VoiceSetupService | undefined;
let taskController: TaskIpcController | undefined;
let agentRegistry: ReturnType<typeof createAgentRegistry> | undefined;
let approvalService: Awaited<ReturnType<typeof createApprovalService>> | undefined;
let connectorRegistry: Awaited<ReturnType<typeof createConnectorRegistry>> | undefined;
let memoryStore: MemoryStore | undefined;
let timelineStore: TimelineStore | undefined;
let miniMaxKeyStore: ReturnType<typeof createSecureKeyStore> | undefined;
let tavilyMcpClient: ReturnType<typeof createTavilyRemoteMcpClient> | undefined;
let tavilySetupService: TavilySetupService | undefined;
let latestResearchReport: ResearchReport | undefined;
let taskLogDir = '';
let artifactRoot = '';
const pendingAgentDrafts = new Map<string, AgentBirthDraft>();
let pendingAgentSwitch: { agentId: string; name: string } | undefined;
const pendingLandingPageActions = new Map<string, { changeRequest?: string; request: string }>();
const staticSiteServers: Array<{ stop: () => void }> = [];
const agentCreatedSwitchPrompt = 'Agent Created, Should I switch to new agent';
let activeLandingPageSession:
  | {
      files: LandingPageFile[];
      outputDir: string;
      request: string;
      stopPreview: () => void;
      url: string;
    }
  | undefined;
const voiceTraceIds = new Map<string, string>();
const voiceEnabled = process.env.BUBBLES_VOICE_ENABLED !== 'false';
const voiceApprovalsEnabled = voiceEnabled && process.env.BUBBLES_VOICE_APPROVALS_ENABLED !== 'false';
const creativeImageEnabled = process.env.BUBBLES_CREATIVE_IMAGE !== 'false';
const creativeMusicEnabled = process.env.BUBBLES_CREATIVE_MUSIC !== 'false';
const creativeVideoEnabled = process.env.BUBBLES_CREATIVE_VIDEO !== 'false';
const landingPageEnabled = process.env.BUBBLES_CODING_LANDING_PAGE !== 'false';
const minimaxMediaFixture = shouldUseMiniMaxMediaFixture(process.env);

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
  speakOnArrival?: boolean;
  text: string;
  voiceText?: string;
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
  taskEvents: TaskEvent[];
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

function presentApprovalPopupWindow() {
  if (!appState.approvals.some((approval) => approval.status === 'pending')) {
    return;
  }

  const window = createPanelWindow();
  sendToWindow(avatarWindow, 'panel:state', true);
  window?.focus();
  keepAvatarAbovePanel();
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
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  registerWindowIpc();
  const userDataPath = app.getPath('userData');
  taskLogDir = join(userDataPath, 'task-logs');
  artifactRoot = join(userDataPath, 'artifacts');
  const runCommand = createProcessRunner();
  tavilyMcpClient = createTavilyRemoteMcpClient({
    fetch: async (url, init) => {
      const response = await globalThis.fetch(url, init);
      return {
        ok: response.ok,
        status: response.status,
        text: () => response.text()
      };
    }
  });
  miniMaxKeyStore = createSecureKeyStore({ runCommand });
  setupService = registerSetupIpc({ keyStore: miniMaxKeyStore, onStatusChange: broadcastSetupStatus });
  tavilySetupService = createTavilySetupService({
    keyStore: miniMaxKeyStore,
    mcpClient: tavilyMcpClient,
    onStatusChange: handleTavilySetupStatus
  });
  registerTavilySetupIpc(tavilySetupService);
  voiceSetupService = registerVoiceSetupIpc({
    enabled: voiceEnabled,
    getMiniMaxTokenPlanKey: () => miniMaxKeyStore?.getTokenPlanKey() ?? Promise.resolve(undefined),
    keyStore: miniMaxKeyStore,
    onStatusChange: broadcastVoiceSetupStatus
  });
  registerVoicePermissionIpc();
  registerVoiceIpc(
    ipcMain,
    createVoiceIpcController({
      enabled: voiceEnabled,
      publish: handleVoiceEvent,
      speakText: speakWithMiniMax,
      stopSpeaking: (input) => {
        const ttsId = input?.ttsId ?? 'tts-current';
        appendTraceEvent('tts.stop_requested', {
          ttsId,
          fields: { ok: true }
        });
        return { ok: true, ttsId };
      },
      transcribeAudio: transcribeVoiceAudio
    })
  );
  const projectRoot = resolveProjectRoot();
  agentRegistry = createAgentRegistry({ agentsRoot: join(projectRoot, 'agents') });
  void hydrateAgentState();
  void hydrateMemoryState().then(initializeSafetyIpc);
  registerLogIpc();
  registerArtifactProtocol();
  registerCapabilityIpc({ artifactRoot });
  taskController = registerTaskIpc({
    logDir: taskLogDir,
    getMiniMaxApiKey: () => miniMaxKeyStore?.getTokenPlanKey() ?? Promise.resolve(undefined),
    getActiveAgentId: () => appState.activeAgent?.id ?? 'general-assistant',
    getMemoryContext: (_userText, activeAgentId) =>
      memoryStore?.query({ agentId: activeAgentId, limit: 8 }) ?? Promise.resolve([]),
    onTaskEvent: handleTaskEvent,
    onTaskStarted: handleTaskStarted,
    preflight: preflightMiniMaxApi
  });
  createWindow();
  registerVoiceShortcut({
    createPanelWindow,
    enabled: voiceEnabled,
    getPanelWindow: () => panelWindow,
    onRegistrationFailed: (accelerator) => {
      appendTraceEvent('voice.shortcut_registration_failed', {
        fields: { accelerator }
      });
    },
    sendShortcutStart: (window) => sendToWindow(window, VOICE_SHORTCUT_CHANNEL),
    shortcut: globalShortcut
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  unregisterVoiceShortcut(globalShortcut);
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
    const apiKey = await miniMaxKeyStore?.getTokenPlanKey();

    if (!apiKey) {
      throw new Error('MiniMax Token Plan key is required before agent birth.');
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
        agentMarkdown: draft.agentMarkdown,
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
    presentApprovalPopupWindow();
    broadcastAppState();
    return draft.profile;
  });

  ipcMain.handle('agents:create-approved-draft', async (_event, draft: AgentBirthDraft) => {
    const agent = await agentRegistry?.create(draft, { activate: false });

    if (agent) {
      pendingAgentSwitch = { agentId: agent.id, name: agent.name };
      await timelineStore?.append({
        type: 'agent_created',
        title: 'Agent created',
        summary: `${agent.name} was created.`,
        agentId: agent.id,
        metadata: { skillsPath: agent.skillsPath }
      });
      appState.messages = [
        ...appState.messages,
        {
          id: Date.now() + 1,
          author: 'bubbles',
          speakOnArrival: true,
          text: agentCreatedSwitchPrompt,
          voiceText: agentCreatedSwitchPrompt
        }
      ];
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

function registerVoicePermissionIpc() {
  ipcMain.handle('voice:request-microphone-access', async () => {
    if (process.platform !== 'darwin') {
      return { ok: true as const, status: 'granted' };
    }

    const granted = await systemPreferences.askForMediaAccess('microphone');
    return { ok: granted, status: granted ? 'granted' : 'denied' };
  });

  ipcMain.handle('voice:open-microphone-settings', async () => {
    const url =
      process.platform === 'darwin'
        ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
        : process.platform === 'win32'
          ? 'ms-settings:privacy-microphone'
          : '';

    if (!url) {
      return { ok: false as const, error: 'Open your system settings and allow microphone access for Bubbles.' };
    }

    await shell.openExternal(url);
    return { ok: true as const };
  });
}

async function transcribeVoiceAudio(input: { audioDataUrl: string; mimeType: string }) {
  const [geminiApiKey, openAiApiKey] = await Promise.all([
    readOptionalKey(() => miniMaxKeyStore?.getGeminiVoiceKey() ?? Promise.resolve(undefined)),
    readOptionalKey(() => miniMaxKeyStore?.getOpenAiVoiceKey() ?? Promise.resolve(undefined))
  ]);
  const service = createVoiceTranscriptionService({
    geminiApiKey,
    openAiApiKey
  });
  const result = await service.transcribe({
    audioDataUrl: input.audioDataUrl,
    mimeType: input.mimeType
  });

  if (result.ok) {
    return result;
  }

  return {
    ok: false as const,
    error: result.error,
    provider: result.provider ?? (geminiApiKey ? 'gemini' : openAiApiKey ? 'openai' : 'gemini'),
    reason: result.reason,
    retryable: result.retryable
  };
}

async function readOptionalKey(read: () => Promise<string | undefined>) {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

async function speakWithMiniMax(input: { text: string; ttsId: string }) {
  appendTraceEvent('tts.speak_requested', {
    ttsId: input.ttsId,
    fields: { textLength: input.text.length }
  });

  const apiKey = await miniMaxKeyStore?.getTokenPlanKey();

  if (!apiKey) {
    const result = { ok: false as const, ttsId: input.ttsId, error: 'MiniMax Token Plan key is required for voice playback.' };
    appendTraceEvent('tts.speak_failed', {
      ttsId: result.ttsId,
      fields: { error: result.error, ok: false }
    });
    return result;
  }

  const service = createMiniMaxTtsService({ apiKey });
  const result = await service.speak({
    artifactDir: join(resolveArtifactRoot(), 'tts'),
    text: input.text,
    ttsId: input.ttsId
  });

  appendTraceEvent(result.ok ? 'tts.speak_completed' : 'tts.speak_failed', {
    ttsId: result.ttsId,
    fields: {
      error: result.ok ? undefined : result.error,
      ok: result.ok
    }
  });

  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    audioUrl: toArtifactUrl(result.audioPath)
  };
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

function broadcastVoiceSetupStatus(status: VoiceSetupStatus) {
  sendToWindow(avatarWindow, 'voice-setup:status', status);
  sendToWindow(panelWindow, 'voice-setup:status', status);
}

function broadcastTavilySetupStatus(status: TavilySetupStatus) {
  sendToWindow(avatarWindow, 'tavily:status', status);
  sendToWindow(panelWindow, 'tavily:status', status);
}

function handleTavilySetupStatus(status: TavilySetupStatus) {
  broadcastTavilySetupStatus(status);
  void syncTavilyConnectorStatus(status);
}

async function syncTavilyConnectorStatus(status: TavilySetupStatus) {
  if (!connectorRegistry) {
    return;
  }

  const connector = await connectorRegistry.get('tavily-research');

  if (!connector) {
    return;
  }

  if (status.state === 'ready') {
    await connectorRegistry.setHealth('tavily-research', {
      authStatus: 'ready',
      healthStatus: connector.enabled ? 'healthy' : 'unknown'
    });
  } else if (status.state === 'needs_api_key') {
    await connectorRegistry.setHealth('tavily-research', {
      authStatus: 'not_configured',
      healthStatus: 'unknown'
    });
  } else if (status.state === 'setup_error') {
    await connectorRegistry.setHealth('tavily-research', {
      authStatus: 'error',
      healthStatus: 'unhealthy',
      lastError: status.error
    });
  } else {
    return;
  }

  await hydrateConnectorState();
  broadcastAppState();
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

  if (await handlePendingAgentSwitch(userText)) {
    return true;
  }

  if (latestResearchReport && isReadResearchPrompt(userText)) {
    appState.messages = [
      ...appState.messages,
      { id: Date.now(), author: 'user', text: userText },
      {
        id: Date.now() + 1,
        author: 'bubbles',
        citations: latestResearchReport.citations,
        text: latestResearchReport.text,
        voiceText: latestResearchReport.text
      }
    ];
    appState.avatarState = 'celebrating';
    broadcastAppState();
    return true;
  }

  if (latestResearchReport && isResearchFollowUp(userText)) {
    const apiKey = await miniMaxKeyStore?.getTokenPlanKey();

    if (apiKey) {
      const service = createResearchService({
        generateText: (prompt) => generateMiniMaxText(apiKey, prompt)
      });
      latestResearchReport = await service.answerFollowUp({ question: userText, report: latestResearchReport });
      await persistResearchReport(latestResearchReport, 'Research follow-up answered');
      appState.messages = [
        ...appState.messages,
        { id: Date.now(), author: 'user', text: userText },
        {
          id: Date.now() + 1,
          author: 'bubbles',
          citations: latestResearchReport.citations,
          text: latestResearchReport.text,
          voiceText: latestResearchReport.voiceText
        }
      ];
      appState.avatarState = 'celebrating';
      await hydrateMemoryState();
      broadcastAppState();
      return true;
    }
  }

  if (isLandingPageRevisionPrompt(userText, Boolean(activeLandingPageSession))) {
    if (!approvalService || !activeLandingPageSession) {
      appState.messages = [
        ...appState.messages,
        { id: Date.now(), author: 'user', text: userText },
        {
          id: Date.now() + 1,
          author: 'bubbles',
          text: 'Landing-page revision approvals are not ready yet.'
        }
      ];
      appState.avatarState = 'concerned';
      broadcastAppState();
      return true;
    }

    const approval = await approvalService.create({
      taskId: `task-landing-${Date.now()}`,
      agentId: 'general-assistant',
      actionType: 'shell_command',
      title: 'Generate landing page',
      explanation: 'Bubbles needs approval before updating the downloaded page, running checks, and reopening the local preview.',
      preview: {
        request: activeLandingPageSession.request,
        changeRequest: userText,
        revision: true,
        sandboxed: true,
        workflow: ['generate MiniMax code', 'node scripts/accessibility-check.mjs', 'vite build', 'save to Downloads', 'serve locally', 'open browser']
      }
    });
    pendingLandingPageActions.set(approval.id, { request: activeLandingPageSession.request, changeRequest: userText });
    appState.messages = [
      ...appState.messages,
      { id: Date.now(), author: 'user', text: userText },
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: 'I drafted a landing-page revision workflow. Please approve it before I update the downloaded project and reopen the local preview.'
      }
    ];
    appState.avatarState = 'waiting_approval';
    appState.approvals = await approvalService.list();
    presentApprovalPopupWindow();
    broadcastAppState();
    return true;
  }

  const routeIntent = classifyIntent(userText);

  if (routeIntent.taskType === 'agent.create') {
    return createAgentBirthApprovalFromRequest(userText);
  }

  const router = createFlowRouter({
    creative: {
      run: (request) => runCreativeCapability(request)
    },
    createApproval: async (approval) => {
      if (!approvalService) {
        throw new Error('Approval service is unavailable.');
      }

      const created = await approvalService.create(approval);
      rememberLandingPageAction(created);
      return created;
    },
    research: {
      run: (query) => runTavilyResearch(query)
    }
  });
  const mediaKind = mediaKindForTask(routeIntent.taskType);
  const taskStartedAt = Date.now();
  const workingMessageId = mediaKind ? taskStartedAt + 1 : undefined;
  const mediaTaskId = mediaKind ? `task-${mediaKind}-${taskStartedAt}` : undefined;

  if (workingMessageId && mediaKind && mediaTaskId) {
    appState.messages = [
      ...appState.messages,
      { id: taskStartedAt, author: 'user', text: userText },
      {
        id: workingMessageId,
        author: 'bubbles',
        text: mediaWorkingMessage(mediaKind)
      }
    ];
    appState.activeTaskId = mediaTaskId;
    appendCapabilityTaskEvent(
      {
        taskId: mediaTaskId,
        type: 'task.received',
        payload: { activeAgentId: routeIntent.suggestedAgentId, taskType: routeIntent.taskType },
        createdAt: new Date().toISOString()
      },
      'thinking'
    );
    appendCapabilityTaskEvent(
      {
        taskId: mediaTaskId,
        type: 'task.status',
        payload: { status: 'running', text: mediaRunningStatus(mediaKind) },
        createdAt: new Date().toISOString()
      },
      'working'
    );
    appState.avatarState = 'working';
    void timelineStore?.append({
      type: 'task_started',
      title: 'Task started',
      summary: userText,
      taskId: mediaTaskId,
      agentId: routeIntent.suggestedAgentId
    }).then(() => hydrateMemoryState());
    broadcastAppState();
  }

  const result = await router.route({
    activeAgentId: appState.activeAgent?.id ?? 'general-assistant',
    userText
  });

  if (!result.handled) {
    if (workingMessageId && mediaTaskId) {
      appState.messages = appState.messages.filter((message) => message.id !== workingMessageId && message.id !== workingMessageId - 1);
      appState.activeTaskId = null;
      appState.avatarState = 'idle';
      appendCapabilityTaskEvent(
        {
          taskId: mediaTaskId,
          type: 'task.error',
          payload: { errorMessage: 'Media task was not handled by the capability router.' },
          createdAt: new Date().toISOString()
        },
        'concerned'
      );
      broadcastAppState();
    }
    return false;
  }

  const bubbleMessage = {
    id: workingMessageId ?? Date.now() + 1,
    author: 'bubbles' as const,
    artifacts: result.artifacts,
    citations: result.citations,
    speakOnArrival: result.speakOnArrival,
    text: result.message,
    voiceText: result.voiceText
  };
  appState.messages = workingMessageId
    ? appState.messages.map((message) => (message.id === workingMessageId ? bubbleMessage : message))
    : [...appState.messages, { id: Date.now(), author: 'user', text: userText }, bubbleMessage];
  if (mediaTaskId) {
    const eventType = result.avatarState === 'concerned' ? 'task.error' : 'task.result';
    appendCapabilityTaskEvent(
      {
        taskId: mediaTaskId,
        type: eventType,
        payload:
          eventType === 'task.error'
            ? { errorMessage: result.message, taskType: result.taskType }
            : {
                text: result.message,
                taskType: result.taskType,
                artifactCount: result.artifacts?.length ?? 0
              },
        createdAt: new Date().toISOString()
      },
      result.avatarState
    );
    appState.activeTaskId = null;
    void timelineStore?.append({
      type: eventType === 'task.error' ? 'task_failed' : 'task_completed',
      title: eventType === 'task.error' ? 'Task failed' : 'Task completed',
      summary: result.message,
      taskId: mediaTaskId,
      agentId: result.suggestedAgentId
    }).then(() => hydrateMemoryState());
  }
  appState.avatarState = result.avatarState;
  appState.approvals = (await approvalService?.list()) ?? appState.approvals;
  if (result.avatarState === 'waiting_approval') {
    presentApprovalPopupWindow();
  }
  await hydrateMemoryState();
  broadcastAppState();
  return true;
}

async function createAgentBirthApprovalFromRequest(userText: string) {
  const taskId = `task-agent-${Date.now()}`;
  const startedAt = Date.now();

  appState.activeTaskId = taskId;
  for (const event of createAgentBirthDraftingTaskEvents({ taskId, userText })) {
    appendCapabilityTaskEvent(event, 'thinking');
  }
  appState.messages = [
    ...appState.messages,
    { id: startedAt, author: 'user', text: userText },
    {
      id: startedAt + 1,
      author: 'bubbles',
      text: "I'm drafting the agent files now."
    }
  ];
  appState.avatarState = 'thinking';
  broadcastAppState();

  if (!approvalService) {
    appState.activeTaskId = null;
    appendCapabilityTaskEvent(
      createTaskEvent(taskId, 'task.error', {
        errorMessage: 'Agent creation approvals are not ready yet.',
        taskType: 'agent.create'
      }),
      'concerned'
    );
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now(),
        author: 'bubbles',
        text: 'Agent creation approvals are not ready yet.'
      }
    ];
    appState.avatarState = 'concerned';
    broadcastAppState();
    return true;
  }

  const apiKey = await miniMaxKeyStore?.getTokenPlanKey();

  if (!apiKey) {
    appState.activeTaskId = null;
    appendCapabilityTaskEvent(
      createTaskEvent(taskId, 'task.error', {
        errorMessage: 'MiniMax Token Plan key is required before agent birth.',
        taskType: 'agent.create'
      }),
      'concerned'
    );
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now(),
        author: 'bubbles',
        text: 'MiniMax Token Plan key is required before agent birth.'
      }
    ];
    appState.avatarState = 'concerned';
    broadcastAppState();
    return true;
  }

  const service = createAgentBirthService({
    generateJson: (prompt) => generateMiniMaxJson(apiKey, prompt, { timeoutMs: agentBirthDraftTimeoutMs() })
  });
  try {
    let draft: AgentBirthDraft;

    try {
      draft = await service.preview(userText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (/visual customization/i.test(message)) {
        throw error;
      }

      draft = createRecommendedAgentBirthDraft(userText);
      appendCapabilityTaskEvent(
        createTaskEvent(taskId, 'task.status', {
          status: 'running',
          text: 'MiniMax draft was unavailable, so I prepared safe recommended demo agent files.'
        }),
        'thinking'
      );
    }

    const approval = await approvalService.create({
      taskId,
      agentId: appState.activeAgent?.id ?? 'general-assistant',
      actionType: 'agent_file_create',
      title: `Create ${draft.profile.name}`,
      explanation: 'Bubbles needs approval before writing new agent files.',
      preview: {
        agent: draft.profile,
        agentMarkdown: draft.agentMarkdown,
        skillsMarkdown: draft.skillsMarkdown
      }
    });
    pendingAgentDrafts.set(approval.id, draft);
    appState.activeTaskId = taskId;
    for (const event of createAgentBirthTaskEvents({
      agentName: draft.profile.name,
      approvalId: approval.id,
      taskId
    })) {
      appendCapabilityTaskEvent(event, 'waiting_approval');
    }
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now(),
        author: 'bubbles',
        text: `I drafted ${draft.profile.name}. Please approve the agent file creation before I write it.`
      }
    ];
    appState.avatarState = 'waiting_approval';
    appState.approvals = await approvalService.list();
    presentApprovalPopupWindow();
    broadcastAppState();
  } catch (error) {
    const errorMessage = `I could not draft that agent: ${redactSecrets(error instanceof Error ? error.message : String(error))}`;
    appState.activeTaskId = null;
    appendCapabilityTaskEvent(
      createTaskEvent(taskId, 'task.error', {
        errorMessage,
        taskType: 'agent.create'
      }),
      'concerned'
    );
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now(),
        author: 'bubbles',
        text: errorMessage
      }
    ];
    appState.avatarState = 'concerned';
    broadcastAppState();
  }
  return true;
}

function agentBirthDraftTimeoutMs() {
  const timeout = Number(process.env.BUBBLES_AGENT_BIRTH_TIMEOUT_MS ?? 20000);

  return Number.isFinite(timeout) && timeout > 0 ? timeout : 20000;
}

async function handlePendingAgentSwitch(userText: string) {
  const pending = pendingAgentSwitch;

  if (!pending) {
    return false;
  }

  if (isAgentSwitchConfirmation(userText)) {
    pendingAgentSwitch = undefined;
    appState.activeAgent = (await agentRegistry?.activate(pending.agentId)) ?? appState.activeAgent;
    await timelineStore?.append({
      type: 'agent_activated',
      title: 'Agent activated',
      summary: `${pending.name} is now active.`,
      agentId: pending.agentId
    });
    appState.messages = [
      ...appState.messages,
      { id: Date.now(), author: 'user', text: userText },
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: `${pending.name} is now active.`
      }
    ];
    appState.avatarState = 'celebrating';
    await hydrateAgentState();
    await hydrateMemoryState();
    broadcastAppState();
    return true;
  }

  if (isAgentSwitchDenial(userText)) {
    pendingAgentSwitch = undefined;
    appState.messages = [
      ...appState.messages,
      { id: Date.now(), author: 'user', text: userText },
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: 'Okay, I will keep the current agent active.'
      }
    ];
    appState.avatarState = 'idle';
    broadcastAppState();
    return true;
  }

  pendingAgentSwitch = undefined;
  return false;
}

function isAgentSwitchConfirmation(userText: string) {
  return /\b(yes|yeah|yep|sure|switch|activate|use it|use the new agent)\b/i.test(userText);
}

function isAgentSwitchDenial(userText: string) {
  return /\b(no|nope|not now|stay|keep current|keep bubbles)\b/i.test(userText);
}

async function runCreativeCapability(request: { kind: 'image' | 'music' | 'video'; prompt: string }) {
  const enabled =
    request.kind === 'image' ? creativeImageEnabled : request.kind === 'video' ? creativeVideoEnabled : creativeMusicEnabled;

  if (!enabled) {
    const label = request.kind === 'image' ? 'Image' : request.kind === 'video' ? 'Video' : 'Music';
    return { ok: false as const, error: `${label} generation is disabled.` };
  }

  const apiKey = await miniMaxKeyStore?.getTokenPlanKey();

  if (!apiKey) {
    return { ok: false as const, error: 'MiniMax Token Plan key is required for media generation.' };
  }

  const service = createMiniMaxCreativeService({
    apiKey
  });
  return service.run({
    artifactDir: join(resolveArtifactRoot(), `${request.kind}-${Date.now()}`),
    fixture: minimaxMediaFixture,
    kind: request.kind,
    prompt: request.prompt
  });
}

function mediaKindForTask(taskType: TaskType) {
  if (taskType === 'creative.image') {
    return 'image' as const;
  }

  if (taskType === 'creative.music') {
    return 'music' as const;
  }

  if (taskType === 'creative.video') {
    return 'video' as const;
  }

  return undefined;
}

function mediaWorkingMessage(kind: 'image' | 'music' | 'video') {
  if (kind === 'image') {
    return "I'm generating your image. This can take a moment.";
  }

  if (kind === 'video') {
    return "I'm generating your video. This can take a few minutes.";
  }

  return "I'm generating your music. This can take a minute or two.";
}

function mediaRunningStatus(kind: 'image' | 'music' | 'video') {
  if (kind === 'image') {
    return 'Generating image';
  }

  if (kind === 'video') {
    return 'Generating video';
  }

  return 'Generating music';
}

function appendCapabilityTaskEvent(event: TaskEvent, avatarState: AvatarState) {
  appState.taskEvents = [...appState.taskEvents, event];
  appState.avatarState = avatarState;
  appendTraceEvent(event.type, {
    taskId: event.taskId,
    fields: {
      avatarState,
      payloadKeys: Object.keys(event.payload)
    }
  });
  sendToWindow(avatarWindow, 'tasks:event', event);
  sendToWindow(panelWindow, 'tasks:event', event);
}

async function runTavilyResearch(query: string) {
  const minimaxApiKey = await miniMaxKeyStore?.getTokenPlanKey();
  const tavilyApiKey = await miniMaxKeyStore?.getTavilyKey();
  const connector = await connectorRegistry?.get('tavily-research');

  if (!minimaxApiKey) {
    return { ok: false as const, error: 'MiniMax Token Plan key is required to synthesize Tavily research.' };
  }

  if (!tavilyApiKey || !connector || !tavilyMcpClient) {
    return { ok: false as const, error: 'Tavily Research is not connected. Add a Tavily API key in Connectors.' };
  }

  const tavily = createTavilyResearchConnector({ mcpClient: tavilyMcpClient });
  const search = await tavily.search({ ...connector, authStatus: 'ready' }, query, { apiKey: tavilyApiKey });

  if (!search.ok) {
    return { ok: false as const, error: search.error };
  }

  const service = createResearchService({
    generateText: (prompt) => generateMiniMaxText(minimaxApiKey, prompt)
  });
  latestResearchReport = await service.createReport({
    extractedContent: search.extractedContent,
    query,
    results: search.results
  });
  await persistResearchReport(latestResearchReport, 'Research completed');
  return { ok: true as const, report: latestResearchReport };
}

async function persistResearchReport(report: ResearchReport, title: string) {
  const summary = await memoryStore?.create({
    agentId: 'general-assistant',
    content: `Research: ${report.query}\n\n${report.text.slice(0, 1200)}`,
    sourceTaskId: report.id,
    tags: ['research'],
    type: 'task_summary',
    importance: 4
  });
  await timelineStore?.append({
    agentId: 'general-assistant',
    memoryId: summary?.id,
    metadata: {
      citations: report.citations.map((citation) => ({ title: citation.title, url: citation.url })),
      query: report.query
    },
    summary: report.text.slice(0, 500),
    taskId: report.id,
    title,
    type: 'task_completed'
  });
}

function resolveArtifactRoot() {
  if (!artifactRoot) {
    artifactRoot = join(app.getPath('userData'), 'artifacts');
  }

  return artifactRoot;
}

function toArtifactUrl(path: string) {
  return `bubbles-artifact://local/${encodeURIComponent(path)}`;
}

function rememberLandingPageAction(approval: ApprovalRequest) {
  if (approval.actionType !== 'shell_command' || approval.title !== 'Generate landing page') {
    return;
  }

  const request = stringPreviewValue(approval.preview.request);
  const changeRequest = stringPreviewValue(approval.preview.changeRequest);

  if (request) {
    pendingLandingPageActions.set(approval.id, { request, changeRequest });
  }
}

type LandingPageRunResult = 'not_applicable' | 'success' | 'failed';

async function runApprovedLandingPageAction(approval: ApprovalRequest): Promise<LandingPageRunResult> {
  const traceId = `trace-c7-${approval.id}`;
  const pendingAction = pendingLandingPageActions.get(approval.id) ?? {
    request: stringPreviewValue(approval.preview.request) ?? ''
  };

  if (!pendingAction.request) {
    return 'not_applicable';
  }

  pendingLandingPageActions.delete(approval.id);

  if (!landingPageEnabled) {
    appState.messages = [...appState.messages, { id: Date.now() + 1, author: 'bubbles', text: 'Landing-page generation is disabled.' }];
    return 'failed';
  }

  const apiKey = await miniMaxKeyStore?.getTokenPlanKey();

  if (!apiKey) {
    appState.messages = [
      ...appState.messages,
      { id: Date.now() + 1, author: 'bubbles', text: 'MiniMax Token Plan key is required for landing-page generation.' }
    ];
    return 'failed';
  }

  try {
    assertWorkflowCommandsAllowed([
      { command: 'node', args: ['scripts/accessibility-check.mjs'] },
      { command: 'vite', args: ['build'] }
    ]);
    const sandboxRoot = join(resolveArtifactRoot(), 'landing-pages');
    const runner = createLandingPageRunner({
      sandboxRoot,
      generateCode: createMiniMaxLandingPageCodeGenerator({
        generateJson: (prompt) =>
          generateMiniMaxJson(apiKey, prompt, {
            maxCompletionTokens: 8000,
            timeoutMs: 45000,
            useJsonResponseFormat: false
          })
      })
    });
    const previousFiles =
      pendingAction.changeRequest && activeLandingPageSession?.request === pendingAction.request
        ? activeLandingPageSession.files
        : undefined;
    const generated = await runner.generate({
      request: pendingAction.request,
      changeRequest: pendingAction.changeRequest,
      previousFiles
    });
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
      return 'failed';
    }

    const generatedFiles = await readLandingPageProjectFiles(generated.siteDir);

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
      return 'failed';
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
      return 'failed';
    }

    const saved = await copyManagedLandingPageProject({
      downloadsRoot: join(app.getPath('downloads'), 'Bubbles Landing Pages'),
      request: pendingAction.request,
      sourceDir: generated.siteDir
    });
    const port = await findAvailablePort(4173, { host: '127.0.0.1' });
    const server = createStaticSiteServer(join(saved.outputDir, 'dist'));
    const served = await server.start(port);
    activeLandingPageSession?.stopPreview();
    staticSiteServers.push(server);
    await shell.openExternal(served.url);
    const artifact = {
      ...generated.artifact,
      path: saved.outputDir,
      title: saved.projectName,
      url: served.url
    };
    activeLandingPageSession = {
      files: generatedFiles,
      outputDir: saved.outputDir,
      request: pendingAction.request,
      stopPreview: () => server.stop(),
      url: served.url
    };
    appendTraceEvent('c7.site_served', {
      approvalId: approval.id,
      taskId: approval.taskId,
      traceId,
      fields: {
        artifactId: artifact.id,
        port,
        projectName: saved.projectName,
        url: served.url
      }
    });
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        artifacts: [artifact],
        speakOnArrival: true,
        text: 'I opened the landing page locally. Take a look, and tell me what to change.',
        voiceText: 'The webpage is ready. Please look at it in your browser.'
      }
    ];
    return 'success';
  } catch (error) {
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: `The landing-page sandbox failed: ${redactSecrets(error)}`
      }
    ];
    return 'failed';
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

async function checkConnectorHealth(connector: ConnectorConfig): Promise<ConnectorHealth> {
  if (!connector.enabled) {
    return {
      authStatus: 'not_configured',
      healthStatus: 'unhealthy',
      lastError: 'Connector is disabled.'
    };
  }

  if (connector.type === 'tavily_research') {
    const tavilyApiKey = await miniMaxKeyStore?.getTavilyKey();

    return tavilyApiKey
      ? { authStatus: 'ready', healthStatus: 'healthy' }
      : {
          authStatus: 'needs_auth',
          healthStatus: 'unhealthy',
          lastError: 'Add a Tavily API key before running live web research.'
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
    if (approval.actionType === 'agent_file_create') {
      appendCapabilityTaskEvent(
        createTaskEvent(approval.taskId, approval.status === 'denied' ? 'approval.denied' : 'task.cancelled', {
          text: `Agent file creation was ${approval.status}.`,
          taskType: 'agent.create'
        }),
        'idle'
      );
      if (appState.activeTaskId === approval.taskId) {
        appState.activeTaskId = null;
      }
    }
    await hydrateApprovalState();
    await hydrateMemoryState();
    appState.avatarState = 'idle';
    broadcastAppState();
    return;
  }

  if (isLandingPageApproval(approval)) {
    await hydrateApprovalState();
    appState.avatarState = 'working';
    appState.messages = [
      ...appState.messages,
      {
        id: Date.now() + 1,
        author: 'bubbles',
        text: "Approved. I'm generating the landing page now."
      }
    ];
    broadcastAppState();
  }

  const agentDraft = pendingAgentDrafts.get(approval.id) ?? agentDraftFromApprovalPreview(approval.preview);

  if (agentDraft && agentRegistry) {
    const agent = await agentRegistry.create(agentDraft, { activate: false });
    pendingAgentDrafts.delete(approval.id);
    pendingAgentSwitch = { agentId: agent.id, name: agent.name };
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
        speakOnArrival: true,
        text: agentCreatedSwitchPrompt,
        voiceText: agentCreatedSwitchPrompt
      }
    ];
    appendCapabilityTaskEvent(
      createTaskEvent(approval.taskId, 'task.result', {
        text: `${agent.name} files were created.`,
        taskType: 'agent.create'
      }),
      'celebrating'
    );
    if (appState.activeTaskId === approval.taskId) {
      appState.activeTaskId = null;
    }
  }

  const landingPageResult = await runApprovedLandingPageAction(approval);

  await hydrateAgentState();
  await hydrateApprovalState();
  await hydrateMemoryState();
  appState.avatarState = landingPageResult === 'failed' ? 'concerned' : 'celebrating';
  broadcastAppState();
}

function isLandingPageApproval(approval: ApprovalRequest) {
  return approval.actionType === 'shell_command' && approval.title === 'Generate landing page';
}

function agentDraftFromApprovalPreview(preview: Record<string, unknown>): AgentBirthDraft | undefined {
  const profile = preview.agent;
  const agentMarkdown = preview.agentMarkdown;
  const skillsMarkdown = preview.skillsMarkdown;

  if (
    profile &&
    typeof profile === 'object' &&
    !Array.isArray(profile) &&
    typeof agentMarkdown === 'string' &&
    typeof skillsMarkdown === 'string'
  ) {
    return {
      profile: profile as AgentProfile,
      agentMarkdown,
      skillsMarkdown
    };
  }

  return undefined;
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

async function extractMemoriesFromMessage(userText: string) {
  if (!memoryStore || !timelineStore || !miniMaxKeyStore) {
    return;
  }

  const status = await setupService?.getStatus();

  if (status?.state !== 'ready') {
    return;
  }

  const apiKey = await miniMaxKeyStore.getTokenPlanKey();

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

function handleTaskEvent(event: TaskEvent, avatarState: AvatarState) {
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
    void setupService?.markMiniMaxUnhealthy(formatTaskError(event)).then(broadcastSetupStatus);
  }

  broadcastAppState();
  sendToWindow(avatarWindow, 'tasks:event', event);
  sendToWindow(panelWindow, 'tasks:event', event);
}

async function persistFinalTaskEvent(event: TaskEvent) {
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

function formatTaskMessage(event: TaskEvent) {
  if (event.type === 'task.result') {
    return stringPayload(event.payload.text) ?? 'Done. I finished that task.';
  }

  if (event.type === 'task.cancelled') {
    return 'I cancelled that task.';
  }

  return `I hit a MiniMax API error: ${formatTaskError(event)}`;
}

async function preflightMiniMaxApi() {
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
    error: status.tokenPlan.error ?? 'MiniMax API is not ready. Recheck MiniMax in Settings.',
    hint: 'Open Settings and recheck MiniMax after checking your network or Token Plan key.'
  };
}

function formatTaskError(event: TaskEvent) {
  return (
    stringPayload(event.payload.errorMessage) ??
    stringPayload(event.payload.error) ??
    stringPayload(event.payload.rawMessage) ??
    stringPayload(event.payload.reason) ??
    'I hit a MiniMax API error while working on that task.'
  );
}

function isMiniMaxHealthFailure(event: TaskEvent) {
  return event.payload.category === 'network' || event.payload.category === 'auth' || event.payload.category === 'quota';
}

function categorizeSetupFailure(status: SetupStatus) {
  const text = status.tokenPlan.error ?? '';

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
