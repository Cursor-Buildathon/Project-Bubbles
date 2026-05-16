export const RENDERER_GMAIL_SETUP = {
  httpUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send'
  ]
} as const;

export const RENDERER_CALENDAR_SETUP = {
  httpUrl: 'https://calendarmcp.googleapis.com/mcp/v1',
  scopes: [
    'https://www.googleapis.com/auth/calendar.events.owned',
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/calendar.events.freebusy'
  ]
} as const;
