#!/usr/bin/env node

const rawRequest = process.argv[process.argv.length - 1];

function respond(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function fail(id, message) {
  respond({
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: -32000,
      message
    }
  });
  process.exitCode = 1;
}

if (!rawRequest || rawRequest === process.argv[1]) {
  respond({
    jsonrpc: '2.0',
    id: 1,
    result: {
      usage: 'Pass one JSON-RPC request argument. Example method: search.'
    }
  });
  process.exit(0);
}

let request;

try {
  request = JSON.parse(rawRequest);
} catch {
  fail(null, 'Invalid JSON-RPC request.');
  process.exit(1);
}

const id = request?.id ?? 1;
const method = request?.method;
const params = request?.params ?? {};

if (method === 'health' || method === 'ping') {
  respond({
    jsonrpc: '2.0',
    id,
    result: {
      ok: true,
      provider: 'fixture'
    }
  });
  process.exit(0);
}

if (method !== 'search') {
  fail(id, `Unsupported fixture method: ${String(method)}`);
  process.exit(1);
}

const query = typeof params.query === 'string' && params.query.trim() ? params.query.trim() : 'debug query';

respond({
  jsonrpc: '2.0',
  id,
  result: {
    provider: 'fixture',
    results: [
      {
        title: `Fixture research for ${query}`,
        url: 'fixture://web-search',
        snippet:
          'Local fixture response for connector debugging. Replace with a real MCP provider for live research.'
      },
      {
        title: 'Bubbles connector debugging path',
        url: 'fixture://bubbles/connectors',
        snippet:
          'Check connector mode, authStatus, launchConfig.command, launchConfig.args, and MCP command stdout.'
      }
    ]
  }
});
