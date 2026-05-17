import { redactSecrets } from '../security/redactSecrets.js';
import { type TavilyMcpClientLike } from './tavilyResearchConnector.js';

const defaultTavilyRemoteMcpUrl = 'https://mcp.tavily.com/mcp/';

interface ResponseLike {
  headers?: {
    get: (name: string) => string | null;
  };
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

interface TavilyRemoteMcpClientOptions {
  fetch?: FetchLike;
  remoteUrl?: string;
}

export function createTavilyRemoteMcpClient({
  fetch: fetchImpl = globalThis.fetch as FetchLike,
  remoteUrl = defaultTavilyRemoteMcpUrl
}: TavilyRemoteMcpClientOptions = {}): TavilyMcpClientLike {
  let initializedSession: { ok: true; sessionId?: string } | undefined;

  return {
    async call(apiKey, toolName, params) {
      try {
        const session = initializedSession ?? (await initializeSession({ apiKey, fetchImpl, remoteUrl }));

        if (!session.ok) {
          return session;
        }

        initializedSession = session;
        const response = await postMcp({
          apiKey,
          body: {
            id: `${toolName}-${Date.now()}`,
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              arguments: params,
              name: toolName
            }
          },
          fetchImpl,
          remoteUrl,
          sessionId: session.sessionId
        });
        const body = await response.text();

        if (!response.ok) {
          return { ok: false, error: friendlyTavilyError(response.status, body) };
        }

        const parsed = parseMcpBody(body) as { error?: unknown; result?: unknown };

        if (parsed.error) {
          return { ok: false, error: redactSecrets(parsed.error) };
        }

        return { ok: true, result: parsed.result ?? parsed };
      } catch (error) {
        return { ok: false, error: redactSecrets(error) };
      }
    }
  };
}

async function initializeSession({
  apiKey,
  fetchImpl,
  remoteUrl
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  remoteUrl: string;
}): Promise<{ ok: true; sessionId?: string } | { ok: false; error: string }> {
  const response = await postMcp({
    apiKey,
    body: {
      id: `initialize-${Date.now()}`,
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'bubbles',
          version: '0.1.0'
        }
      }
    },
    fetchImpl,
    remoteUrl
  });
  const body = await response.text();

  if (!response.ok) {
    return { ok: false, error: friendlyTavilyError(response.status, body) };
  }

  const parsed = parseMcpBody(body) as { error?: unknown };

  if (parsed.error) {
    return { ok: false, error: redactSecrets(parsed.error) };
  }

  const sessionId = getHeader(response, 'mcp-session-id');

  if (sessionId) {
    await postMcp({
      apiKey,
      body: {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      },
      fetchImpl,
      remoteUrl,
      sessionId
    }).catch(() => undefined);
  }

  return { ok: true, sessionId };
}

function postMcp({
  apiKey,
  body,
  fetchImpl,
  remoteUrl,
  sessionId
}: {
  apiKey: string;
  body: Record<string, unknown>;
  fetchImpl: FetchLike;
  remoteUrl: string;
  sessionId?: string;
}) {
  return fetchImpl(urlWithApiKey(remoteUrl, apiKey), {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
    },
    body: JSON.stringify(body)
  });
}

function urlWithApiKey(remoteUrl: string, apiKey: string) {
  const url = new URL(remoteUrl);

  if (!url.searchParams.has('tavilyApiKey')) {
    url.searchParams.set('tavilyApiKey', apiKey);
  }

  return url.toString();
}

function getHeader(response: ResponseLike, name: string) {
  return response.headers?.get(name) ?? response.headers?.get(name.toLowerCase()) ?? response.headers?.get(name.toUpperCase()) ?? undefined;
}

function parseMcpBody(body: string): unknown {
  const trimmed = body.trim();

  if (!trimmed) {
    return {};
  }

  const dataLine = trimmed
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('data:'));

  if (dataLine) {
    const data = dataLine.replace(/^data:\s*/, '');
    return data ? JSON.parse(data) : {};
  }

  return JSON.parse(trimmed);
}

function friendlyTavilyError(status: number, body: string) {
  if (status === 401 || status === 403 || /api key|auth|unauthori[sz]ed|token/i.test(body)) {
    return 'Tavily authentication failed. Recheck the Tavily API key in Connectors.';
  }

  if (status === 429 || /quota|rate|limit/i.test(body)) {
    return 'Tavily quota or rate limit was reached. Check your Tavily plan and try again later.';
  }

  if (/session|initialize|initialized|protocol/i.test(body)) {
    return redactSecrets(`Tavily MCP session failed (${status}). Recheck the Tavily API key and try again.`);
  }

  return redactSecrets(`Tavily MCP request failed (${status}): ${body}`);
}
