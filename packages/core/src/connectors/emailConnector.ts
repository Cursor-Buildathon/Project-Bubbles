import { type ApprovalRequest, type ConnectorConfig } from '../shared/types.js';
import { GOOGLE_GMAIL_MCP_CONFIG } from './googleWorkspaceScopes.js';
import { type McpCallResult, type McpLaunchConfig } from './mcpClient.js';

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
}

export interface EmailThreadSummary {
  id: string;
  subject: string;
  participants: string[];
  snippet: string;
}

export interface EmailThread extends EmailThreadSummary {
  messages: EmailMessage[];
}

export interface EmailDraftInput {
  body: string;
  subject: string;
  threadId?: string;
  to: string[];
}

export interface EmailDraft {
  id: string;
}

type EmailProvider = 'fixture' | 'mcp' | 'gmail-rest';

interface McpClientLike {
  call: (config: McpLaunchConfig, method: string, params: Record<string, unknown>) => Promise<McpCallResult>;
}

interface EmailConnectorOptions {
  gmailSend?: (config: ConnectorConfig, draftId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  mcpClient?: McpClientLike;
}

export function createEmailConnector({ gmailSend, mcpClient }: EmailConnectorOptions = {}) {
  return {
    async searchThreads(
      config: ConnectorConfig,
      query: string
    ): Promise<{ ok: true; provider: EmailProvider; threads: EmailThreadSummary[] } | { ok: false; error: string }> {
      const readiness = requireReady(config);

      if (!readiness.ok) {
        return readiness;
      }

      if (config.mode === 'fixture') {
        return {
          ok: true,
          provider: 'fixture',
          threads: fixtureThreads(config).map(({ messages: _messages, ...summary }) => summary)
        };
      }

      if (!mcpClient) {
        return { ok: false, error: 'Gmail MCP client is not available.' };
      }

      const response = await mcpClient.call(toMcpLaunchConfig(config), toolName(config, 'searchThreads'), { query });

      if (!response.ok) {
        return response;
      }

      return {
        ok: true,
        provider: 'mcp',
        threads: normalizeThreadSummaries(response.result)
      };
    },

    async getThread(
      config: ConnectorConfig,
      threadId: string
    ): Promise<{ ok: true; provider: EmailProvider; thread: EmailThread } | { ok: false; error: string }> {
      const readiness = requireReady(config);

      if (!readiness.ok) {
        return readiness;
      }

      if (config.mode === 'fixture') {
        const thread = fixtureThreads(config).find((candidate) => candidate.id === threadId) ?? fixtureThreads(config)[0];
        return {
          ok: true,
          provider: 'fixture',
          thread
        };
      }

      if (!mcpClient) {
        return { ok: false, error: 'Gmail MCP client is not available.' };
      }

      const response = await mcpClient.call(toMcpLaunchConfig(config), toolName(config, 'getThread'), { threadId });

      if (!response.ok) {
        return response;
      }

      return {
        ok: true,
        provider: 'mcp',
        thread: normalizeThread(response.result)
      };
    },

    async createDraft(
      config: ConnectorConfig,
      input: EmailDraftInput
    ): Promise<{ ok: true; provider: EmailProvider; draft: EmailDraft } | { ok: false; error: string }> {
      const readiness = requireReady(config);

      if (!readiness.ok) {
        return readiness;
      }

      if (config.mode === 'fixture') {
        return {
          ok: true,
          provider: 'fixture',
          draft: { id: 'fixture-draft-1' }
        };
      }

      if (!mcpClient) {
        return { ok: false, error: 'Gmail MCP client is not available.' };
      }

      const response = await mcpClient.call(toMcpLaunchConfig(config), toolName(config, 'createDraft'), { ...input });

      if (!response.ok) {
        return response;
      }

      return {
        ok: true,
        provider: 'mcp',
        draft: normalizeDraft(response.result)
      };
    },

    async sendDraft(
      config: ConnectorConfig,
      draftId: string
    ): Promise<{ ok: true; provider: EmailProvider } | { ok: false; error: string }> {
      const readiness = requireReady(config);

      if (!readiness.ok) {
        return readiness;
      }

      if (config.mode === 'fixture') {
        return {
          ok: true,
          provider: 'fixture'
        };
      }

      if (mcpClient) {
        const response = await mcpClient.call(toMcpLaunchConfig(config), toolName(config, 'sendDraft'), { draftId });

        if (!response.ok) {
          return response;
        }

        return { ok: true, provider: 'mcp' };
      }

      if (gmailSend) {
        const response = await gmailSend(config, draftId);
        return response.ok ? { ok: true, provider: 'gmail-rest' } : response;
      }

      return { ok: false, error: 'Gmail send is not configured.' };
    },

    async latest(config: ConnectorConfig): Promise<{ ok: true; message: EmailMessage } | { ok: false; error: string }> {
      const latestThread = await this.searchThreads(config, 'newer_than:30d');

      if (!latestThread.ok) {
        return latestThread;
      }

      const thread = await this.getThread(config, latestThread.threads[0]?.id ?? 'fixture-thread-1');

      if (!thread.ok) {
        return thread;
      }

      const message = thread.thread.messages[0];

      return {
        ok: true,
        message
      };
    },

    draftReply(config: ConnectorConfig, instruction: string): Omit<ApprovalRequest, 'id' | 'risk' | 'status' | 'createdAt' | 'resolvedAt'> {
      return {
        taskId: `task-email-${Date.now()}`,
        agentId: config.allowedAgents[0] ?? 'email-calendar-assistant',
        actionType: 'send_email',
        title: 'Send email',
        explanation: 'Bubbles drafted this reply and needs approval before sending.',
        preview: {
          to: 'friend@example.com',
          subject: 'Re: latest email',
          body: instruction.replace(/^reply\s+/i, '')
        }
      };
    }
  };
}

function requireReady(config: ConnectorConfig): { ok: true } | { ok: false; error: string } {
  if (!config.enabled || config.authStatus !== 'ready') {
    return { ok: false, error: 'Email is not connected. Open Connectors and connect Gmail or Outlook.' };
  }

  return { ok: true };
}

function fixtureThreads(config: ConnectorConfig): EmailThread[] {
  const configured = config.launchConfig.fixture?.threads;

  if (Array.isArray(configured)) {
    return configured.map(normalizeThread);
  }

  const latest = config.launchConfig.fixture?.latest as Partial<EmailMessage> | undefined;
  const message = {
    id: latest?.id ?? 'fixture-email-1',
    from: latest?.from ?? 'friend@example.com',
    subject: latest?.subject ?? 'Fixture email',
    body: latest?.body ?? 'Fixture mode is active for email.'
  };

  return [
    {
      id: 'fixture-thread-1',
      subject: message.subject,
      participants: [message.from],
      snippet: message.body,
      messages: [message]
    }
  ];
}

function normalizeThreadSummaries(value: unknown): EmailThreadSummary[] {
  const source = Array.isArray((value as { threads?: unknown }).threads)
    ? (value as { threads: unknown[] }).threads
    : Array.isArray(value)
      ? value
      : [];

  return source.map((thread) => {
    const normalized = normalizeThread(thread);
    return {
      id: normalized.id,
      subject: normalized.subject,
      participants: normalized.participants,
      snippet: normalized.snippet
    };
  });
}

function normalizeThread(value: unknown): EmailThread {
  const item = value as {
    id?: unknown;
    messages?: unknown;
    participants?: unknown;
    snippet?: unknown;
    subject?: unknown;
  };
  const messages = Array.isArray(item.messages) ? item.messages.map(normalizeMessage) : [];
  return {
    id: typeof item.id === 'string' ? item.id : 'thread',
    subject: typeof item.subject === 'string' ? item.subject : messages[0]?.subject ?? 'Email thread',
    participants: Array.isArray(item.participants)
      ? item.participants.filter((participant): participant is string => typeof participant === 'string')
      : messages[0]?.from
        ? [messages[0].from]
        : [],
    snippet: typeof item.snippet === 'string' ? item.snippet : messages[0]?.body ?? '',
    messages
  };
}

function normalizeMessage(value: unknown): EmailMessage {
  const item = value as { body?: unknown; from?: unknown; id?: unknown; subject?: unknown };
  return {
    id: typeof item.id === 'string' ? item.id : 'message',
    from: typeof item.from === 'string' ? item.from : 'unknown@example.com',
    subject: typeof item.subject === 'string' ? item.subject : 'Email',
    body: typeof item.body === 'string' ? item.body : ''
  };
}

function normalizeDraft(value: unknown): EmailDraft {
  const item = value as { id?: unknown; draftId?: unknown };
  return {
    id:
      typeof item.id === 'string'
        ? item.id
        : typeof item.draftId === 'string'
          ? item.draftId
          : 'draft'
  };
}

function toMcpLaunchConfig(config: ConnectorConfig): McpLaunchConfig {
  return {
    args: config.launchConfig.args,
    command: config.launchConfig.command,
    httpUrl: config.launchConfig.httpUrl
  };
}

function toolName(config: ConnectorConfig, key: keyof typeof GOOGLE_GMAIL_MCP_CONFIG.tools): string {
  const configured = config.launchConfig.mcpTools?.[key];
  return configured ?? GOOGLE_GMAIL_MCP_CONFIG.tools[key];
}
