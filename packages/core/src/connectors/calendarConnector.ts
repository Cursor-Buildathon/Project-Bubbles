import { type ApprovalRequest, type ConnectorConfig } from '../shared/types.js';
import { GOOGLE_CALENDAR_MCP_CONFIG } from './googleWorkspaceScopes.js';
import { type McpCallResult, type McpLaunchConfig } from './mcpClient.js';

export interface CalendarEventSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  attendees?: string[];
}

export interface CalendarEventInput {
  attendees?: string[];
  endsAt: string;
  startsAt: string;
  title: string;
  timezone?: string;
}

export interface CalendarSuggestion {
  endsAt: string;
  startsAt: string;
  timezone: string;
}

type CalendarProvider = 'fixture' | 'mcp';

interface McpClientLike {
  call: (config: McpLaunchConfig, method: string, params: Record<string, unknown>) => Promise<McpCallResult>;
}

interface CalendarConnectorOptions {
  mcpClient?: McpClientLike;
}

export function createCalendarConnector({ mcpClient }: CalendarConnectorOptions = {}) {
  return {
    async listEvents(
      config: ConnectorConfig,
      params: Record<string, unknown> = {}
    ): Promise<{ ok: true; events: CalendarEventSummary[]; provider: CalendarProvider } | { ok: false; error: string }> {
      const readiness = requireReady(config);

      if (!readiness.ok) {
        return readiness;
      }

      if (config.mode === 'fixture') {
        return {
          ok: true,
          events: fixtureEvents(config),
          provider: 'fixture'
        };
      }

      if (!mcpClient) {
        return { ok: false, error: 'Calendar MCP client is not available.' };
      }

      const response = await mcpClient.call(toMcpLaunchConfig(config), toolName(config, 'listEvents'), params);

      if (!response.ok) {
        return response;
      }

      return {
        ok: true,
        events: normalizeEvents(response.result),
        provider: 'mcp'
      };
    },

    async suggestTime(
      config: ConnectorConfig,
      params: Record<string, unknown> = {}
    ): Promise<{ ok: true; provider: CalendarProvider; suggestion: CalendarSuggestion } | { ok: false; error: string }> {
      const readiness = requireReady(config);

      if (!readiness.ok) {
        return readiness;
      }

      if (config.mode === 'fixture') {
        return {
          ok: true,
          provider: 'fixture',
          suggestion: {
            startsAt: '2026-05-15T10:00:00.000Z',
            endsAt: '2026-05-15T10:30:00.000Z',
            timezone: 'Google Calendar default'
          }
        };
      }

      if (!mcpClient) {
        return { ok: false, error: 'Calendar MCP client is not available.' };
      }

      const response = await mcpClient.call(toMcpLaunchConfig(config), toolName(config, 'suggestTime'), params);

      if (!response.ok) {
        return response;
      }

      return {
        ok: true,
        provider: 'mcp',
        suggestion: normalizeSuggestion(response.result)
      };
    },

    async createEvent(
      config: ConnectorConfig,
      input: CalendarEventInput
    ): Promise<{ ok: true; event: CalendarEventSummary; provider: CalendarProvider } | { ok: false; error: string }> {
      const readiness = requireReady(config);

      if (!readiness.ok) {
        return readiness;
      }

      if (config.mode === 'fixture') {
        return {
          ok: true,
          event: { id: 'fixture-event-created', ...input },
          provider: 'fixture'
        };
      }

      if (!mcpClient) {
        return { ok: false, error: 'Calendar MCP client is not available.' };
      }

      const response = await mcpClient.call(toMcpLaunchConfig(config), toolName(config, 'createEvent'), { ...input });

      if (!response.ok) {
        return response;
      }

      return {
        ok: true,
        event: normalizeEvent(response.result),
        provider: 'mcp'
      };
    },

    async updateEvent(
      config: ConnectorConfig,
      eventId: string,
      input: Partial<CalendarEventInput>
    ): Promise<{ ok: true; event: CalendarEventSummary; provider: CalendarProvider } | { ok: false; error: string }> {
      const readiness = requireReady(config);

      if (!readiness.ok) {
        return readiness;
      }

      if (config.mode === 'fixture') {
        return {
          ok: true,
          event: {
            id: eventId,
            title: input.title ?? 'Updated fixture event',
            startsAt: input.startsAt ?? '2026-05-15T10:00:00.000Z',
            endsAt: input.endsAt ?? '2026-05-15T10:30:00.000Z',
            attendees: input.attendees
          },
          provider: 'fixture'
        };
      }

      if (!mcpClient) {
        return { ok: false, error: 'Calendar MCP client is not available.' };
      }

      const response = await mcpClient.call(toMcpLaunchConfig(config), toolName(config, 'updateEvent'), { eventId, ...input });

      if (!response.ok) {
        return response;
      }

      return {
        ok: true,
        event: normalizeEvent(response.result),
        provider: 'mcp'
      };
    },

    async listTomorrow(
      config: ConnectorConfig
    ): Promise<{ ok: true; events: CalendarEventSummary[] } | { ok: false; error: string }> {
      const response = await this.listEvents(config, { query: 'tomorrow' });

      return response.ok ? { ok: true, events: response.events } : response;
    },

    draftUpdate(config: ConnectorConfig, instruction: string): Omit<ApprovalRequest, 'id' | 'risk' | 'status' | 'createdAt' | 'resolvedAt'> {
      return {
        taskId: `task-calendar-${Date.now()}`,
        agentId: config.allowedAgents[0] ?? 'email-calendar-assistant',
        actionType: 'calendar_update',
        title: 'Update calendar',
        explanation: 'Bubbles needs approval before changing your calendar.',
        preview: {
          instruction,
          oldEvent: config.launchConfig.fixture?.oldEvent ?? {},
          newEvent: config.launchConfig.fixture?.newEvent ?? { requestedChange: instruction }
        }
      };
    }
  };
}

function requireReady(config: ConnectorConfig): { ok: true } | { ok: false; error: string } {
  if (!config.enabled || config.authStatus !== 'ready') {
    return { ok: false, error: 'Calendar is not connected. Open Connectors and connect Google or Outlook Calendar.' };
  }

  return { ok: true };
}

function fixtureEvents(config: ConnectorConfig): CalendarEventSummary[] {
  const events = config.launchConfig.fixture?.events;

  if (Array.isArray(events)) {
    return normalizeEvents({ events });
  }

  return [
    {
      id: 'fixture-event-1',
      title: 'Fixture planning block',
      startsAt: '2026-05-15T09:00:00.000Z',
      endsAt: '2026-05-15T09:30:00.000Z'
    }
  ];
}

function normalizeEvents(value: unknown): CalendarEventSummary[] {
  const source = Array.isArray((value as { events?: unknown }).events)
    ? (value as { events: unknown[] }).events
    : Array.isArray(value)
      ? value
      : [];

  return source.map(normalizeEvent);
}

function normalizeEvent(value: unknown): CalendarEventSummary {
  const item = value as { attendees?: unknown; endsAt?: unknown; end?: unknown; id?: unknown; startsAt?: unknown; start?: unknown; title?: unknown };
  return {
    id: typeof item.id === 'string' ? item.id : 'event',
    title: typeof item.title === 'string' ? item.title : 'Calendar event',
    startsAt: typeof item.startsAt === 'string' ? item.startsAt : typeof item.start === 'string' ? item.start : '',
    endsAt: typeof item.endsAt === 'string' ? item.endsAt : typeof item.end === 'string' ? item.end : '',
    attendees: Array.isArray(item.attendees)
      ? item.attendees.filter((attendee): attendee is string => typeof attendee === 'string')
      : undefined
  };
}

function normalizeSuggestion(value: unknown): CalendarSuggestion {
  const item = value as { endsAt?: unknown; startsAt?: unknown; timezone?: unknown };
  return {
    startsAt: typeof item.startsAt === 'string' ? item.startsAt : '2026-05-15T10:00:00.000Z',
    endsAt: typeof item.endsAt === 'string' ? item.endsAt : '2026-05-15T10:30:00.000Z',
    timezone: typeof item.timezone === 'string' ? item.timezone : 'Google Calendar default'
  };
}

function toMcpLaunchConfig(config: ConnectorConfig): McpLaunchConfig {
  return {
    args: config.launchConfig.args,
    command: config.launchConfig.command,
    httpUrl: config.launchConfig.httpUrl
  };
}

function toolName(config: ConnectorConfig, key: keyof typeof GOOGLE_CALENDAR_MCP_CONFIG.tools): string {
  const configured = config.launchConfig.mcpTools?.[key];
  return configured ?? GOOGLE_CALENDAR_MCP_CONFIG.tools[key];
}
