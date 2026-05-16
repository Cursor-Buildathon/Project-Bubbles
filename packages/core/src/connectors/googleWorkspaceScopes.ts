export const GOOGLE_GMAIL_MCP_CONFIG = {
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
} as const;

export const GOOGLE_CALENDAR_MCP_CONFIG = {
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
} as const;
