import { describe, expect, it } from 'vitest';
import { GOOGLE_CALENDAR_MCP_CONFIG, GOOGLE_GMAIL_MCP_CONFIG } from './googleWorkspaceScopes.js';

describe('Google Workspace MCP configuration', () => {
  it('uses the verified Gmail endpoint and least-scoped read/compose/send scopes', () => {
    expect(GOOGLE_GMAIL_MCP_CONFIG).toEqual({
      httpUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/gmail.send'
      ],
      tools: {
        createDraft: 'create_draft',
        getThread: 'get_thread',
        searchThreads: 'search_threads',
        sendDraft: 'send_draft'
      }
    });
  });

  it('uses the verified Calendar endpoint and owned-events write scope', () => {
    expect(GOOGLE_CALENDAR_MCP_CONFIG).toEqual({
      httpUrl: 'https://calendarmcp.googleapis.com/mcp/v1',
      scopes: [
        'https://www.googleapis.com/auth/calendar.events.owned',
        'https://www.googleapis.com/auth/calendar.events.readonly',
        'https://www.googleapis.com/auth/calendar.events.freebusy'
      ],
      tools: {
        createEvent: 'create_event',
        listEvents: 'list_events',
        suggestTime: 'suggest_time',
        updateEvent: 'update_event'
      }
    });
  });
});
