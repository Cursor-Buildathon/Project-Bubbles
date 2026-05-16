import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('bubbles', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  closePanel: () => ipcRenderer.invoke('panel:close'),
  moveWindowBy: (delta: { x: number; y: number }) => ipcRenderer.invoke('window:move-by', delta),
  onStateChange: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on('app:state', listener);
    return () => ipcRenderer.removeListener('app:state', listener);
  },
  onPanelStateChange: (callback: (isOpen: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isOpen: boolean) => callback(isOpen);
    ipcRenderer.on('panel:state', listener);
    return () => ipcRenderer.removeListener('panel:state', listener);
  },
  platform: process.platform,
  phase: 'phase-6-8',
  agents: {
    activate: (agentId: string) => ipcRenderer.invoke('agents:activate', agentId),
    createFromPreview: (draft: unknown) => ipcRenderer.invoke('agents:create-from-preview', draft),
    list: () => ipcRenderer.invoke('agents:list'),
    previewBirth: (request: string) => ipcRenderer.invoke('agents:preview-birth', request)
  },
  approvals: {
    approve: (id: string) => ipcRenderer.invoke('approvals:approve', id),
    cancel: (id: string) => ipcRenderer.invoke('approvals:cancel', id),
    create: (input: unknown) => ipcRenderer.invoke('approvals:create', input),
    deny: (id: string) => ipcRenderer.invoke('approvals:deny', id),
    list: () => ipcRenderer.invoke('approvals:list')
  },
  connectors: {
    disconnect: (id: string) => ipcRenderer.invoke('connectors:disconnect', id),
    healthCheck: (id: string) => ipcRenderer.invoke('connectors:healthCheck', id),
    list: () => ipcRenderer.invoke('connectors:list'),
    update: (id: string, input: unknown) => ipcRenderer.invoke('connectors:update', id, input)
  },
  capabilities: {
    openArtifact: (input: unknown) => ipcRenderer.invoke('capabilities:open-artifact', input)
  },
  memory: {
    clear: () => ipcRenderer.invoke('memory:clear'),
    list: () => ipcRenderer.invoke('memory:list'),
    timeline: () => ipcRenderer.invoke('memory:timeline')
  },
  logs: {
    exportRedacted: () => ipcRenderer.invoke('logs:export-redacted')
  },
  sendMessage: (userText: string) => ipcRenderer.invoke('app:send-message', userText),
  setAvatarState: (avatarState: string) => ipcRenderer.invoke('app:set-avatar-state', avatarState),
  voice: {
    bargeIn: (input?: unknown) => ipcRenderer.invoke('voice:barge-in', input),
    getState: () => ipcRenderer.invoke('voice:get-state'),
    onEvent: (callback: (event: unknown, state: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, voiceEvent: unknown, state: unknown) => callback(voiceEvent, state);
      ipcRenderer.on('voice:event', listener);
      return () => ipcRenderer.removeListener('voice:event', listener);
    },
    resolveApproval: (input: unknown) => ipcRenderer.invoke('voice:resolve-approval', input),
    speak: (input: unknown) => ipcRenderer.invoke('voice:speak', input),
    startSession: () => ipcRenderer.invoke('voice:start-session'),
    stopSession: () => ipcRenderer.invoke('voice:stop-session'),
    stopSpeaking: (input?: unknown) => ipcRenderer.invoke('voice:stop-speaking', input),
    submitPartialTranscript: (input: unknown) => ipcRenderer.invoke('voice:submit-partial-transcript', input),
    submitTranscript: (input: unknown) => ipcRenderer.invoke('voice:submit-transcript', input)
  },
  setup: {
    getStatus: () => ipcRenderer.invoke('setup:get-status'),
    installCli: () => ipcRenderer.invoke('setup:install-cli'),
    onStatusChange: (callback: (status: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
      ipcRenderer.on('setup:status', listener);
      return () => ipcRenderer.removeListener('setup:status', listener);
    },
    resetAllMiniMax: () => ipcRenderer.invoke('setup:reset-all-minimax'),
    resetGeneralApiKey: () => ipcRenderer.invoke('setup:reset-general-api-key'),
    resetTokenPlanKey: () => ipcRenderer.invoke('setup:reset-token-plan-key'),
    retry: () => ipcRenderer.invoke('setup:retry'),
    saveGeneralApiKey: (apiKey: string) => ipcRenderer.invoke('setup:save-general-api-key', apiKey),
    saveTokenPlanKey: (apiKey: string) => ipcRenderer.invoke('setup:save-token-plan-key', apiKey)
  },
  tasks: {
    cancel: (taskId: string) => ipcRenderer.invoke('tasks:cancel', taskId),
    getEvents: () => ipcRenderer.invoke('tasks:get-events'),
    onEvent: (callback: (event: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, taskEvent: unknown) => callback(taskEvent);
      ipcRenderer.on('tasks:event', listener);
      return () => ipcRenderer.removeListener('tasks:event', listener);
    },
    start: (userText: string) => ipcRenderer.invoke('tasks:start', userText)
  },
  togglePanel: () => ipcRenderer.invoke('panel:toggle') as Promise<{ isOpen: boolean }>
});
