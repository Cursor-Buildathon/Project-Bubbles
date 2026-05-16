import { describe, expect, it } from 'vitest';
import { type ConnectorConfig } from '../shared/types.js';
import { createCalendarConnector } from './calendarConnector.js';

describe('createCalendarConnector', () => {
  it('lists and suggests times from fixture events', async () => {
    const connector = createCalendarConnector();
    const config = calendarConfig({
      launchConfig: {
        fixture: {
          events: [
            {
              id: 'event-1',
              title: 'Existing focus block',
              startsAt: '2026-05-15T09:00:00.000Z',
              endsAt: '2026-05-15T09:30:00.000Z'
            }
          ]
        }
      }
    });

    await expect(connector.listEvents(config, { query: 'tomorrow' })).resolves.toEqual({
      ok: true,
      events: [
        {
          id: 'event-1',
          title: 'Existing focus block',
          startsAt: '2026-05-15T09:00:00.000Z',
          endsAt: '2026-05-15T09:30:00.000Z'
        }
      ],
      provider: 'fixture'
    });
    await expect(connector.suggestTime(config, { durationMinutes: 30 })).resolves.toMatchObject({
      ok: true,
      provider: 'fixture',
      suggestion: {
        startsAt: '2026-05-15T10:00:00.000Z',
        timezone: 'Google Calendar default'
      }
    });
  });

  it('creates and updates events through verified Calendar MCP tool names', async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
    const connector = createCalendarConnector({
      mcpClient: {
        call: async (_config, method, params) => {
          calls.push({ method, params });
          return { ok: true, result: { id: 'event-2', ...params } };
        }
      }
    });

    const config = calendarConfig({
      mode: 'real',
      launchConfig: {
        httpUrl: 'https://calendarmcp.googleapis.com/mcp/v1'
      }
    });

    await expect(
      connector.createEvent(config, {
        attendees: ['alex@example.com'],
        endsAt: '2026-05-15T10:30:00.000Z',
        startsAt: '2026-05-15T10:00:00.000Z',
        title: 'Planning'
      })
    ).resolves.toMatchObject({ ok: true, event: { id: 'event-2' }, provider: 'mcp' });
    await expect(connector.updateEvent(config, 'event-2', { title: 'Planning sync' })).resolves.toMatchObject({
      ok: true,
      event: { id: 'event-2' },
      provider: 'mcp'
    });
    expect(calls).toEqual([
      {
        method: 'create_event',
        params: {
          attendees: ['alex@example.com'],
          endsAt: '2026-05-15T10:30:00.000Z',
          startsAt: '2026-05-15T10:00:00.000Z',
          title: 'Planning'
        }
      },
      { method: 'update_event', params: { eventId: 'event-2', title: 'Planning sync' } }
    ]);
  });
});

function calendarConfig(overrides: Partial<ConnectorConfig> = {}): ConnectorConfig {
  return {
    id: 'calendar',
    name: 'Google Calendar',
    type: 'calendar',
    enabled: true,
    mode: 'fixture',
    authStatus: 'ready',
    healthStatus: 'healthy',
    allowedAgents: ['email-calendar-assistant'],
    requiredApproval: 'preview_sensitive_actions',
    launchConfig: {},
    updatedAt: '2026-05-15T00:00:00.000Z',
    ...overrides
  };
}
