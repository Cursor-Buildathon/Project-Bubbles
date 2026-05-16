import {
  type ConnectorAuthStatus,
  type ConnectorConfig,
  type ConnectorHealth,
  type ConnectorHealthStatus,
  type ConnectorLaunchConfig,
  type ConnectorMode,
  type ConnectorType
} from '../shared/types.js';
import { redactSecrets } from '../security/redactSecrets.js';
import { openSqliteDatabase } from '../shared/sqliteDatabase.js';

const schemaSql = `
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  mode TEXT NOT NULL,
  authStatus TEXT NOT NULL,
  healthStatus TEXT NOT NULL,
  allowedAgents TEXT NOT NULL,
  requiredApproval TEXT NOT NULL,
  launchConfig TEXT NOT NULL,
  lastCheckedAt TEXT,
  lastError TEXT,
  updatedAt TEXT NOT NULL
);
`;

export type UpdateConnectorInput = Partial<
  Pick<
    ConnectorConfig,
    'enabled' | 'mode' | 'authStatus' | 'healthStatus' | 'allowedAgents' | 'requiredApproval' | 'launchConfig' | 'lastError'
  >
>;

export interface ConnectorRegistry {
  disconnect: (id: string) => Promise<ConnectorConfig>;
  get: (id: string) => Promise<ConnectorConfig | undefined>;
  list: () => Promise<ConnectorConfig[]>;
  setHealth: (id: string, health: ConnectorHealth) => Promise<ConnectorConfig>;
  update: (id: string, input: UpdateConnectorInput) => Promise<ConnectorConfig>;
}

interface ConnectorRegistryOptions {
  databasePath: string;
  now?: () => string;
}

export async function createConnectorRegistry({
  databasePath,
  now = () => new Date().toISOString()
}: ConnectorRegistryOptions): Promise<ConnectorRegistry> {
  const { database, persist } = await openSqliteDatabase(databasePath, schemaSql);
  await seedDefaults();

  async function seedDefaults() {
    for (const connector of defaultConnectors(now())) {
      const existing = database.exec(`SELECT id FROM connectors WHERE id = '${connector.id}'`)[0]?.values[0];

      if (existing) {
        continue;
      }

      database.run(
        `INSERT INTO connectors (id, name, type, enabled, mode, authStatus, healthStatus, allowedAgents, requiredApproval, launchConfig, lastCheckedAt, lastError, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          connector.id,
          connector.name,
          connector.type,
          connector.enabled ? 1 : 0,
          connector.mode,
          connector.authStatus,
          connector.healthStatus,
          JSON.stringify(connector.allowedAgents),
          connector.requiredApproval,
          JSON.stringify(connector.launchConfig),
          connector.lastCheckedAt ?? null,
          connector.lastError ?? null,
          connector.updatedAt
        ]
      );
    }
    await persist();
  }

  async function list() {
    return rowsToConnectors(database.exec('SELECT * FROM connectors ORDER BY id ASC')[0]?.values ?? []).sort(
      (left, right) => orderFor(left.type) - orderFor(right.type)
    );
  }

  async function get(id: string) {
    return list().then((connectors) => connectors.find((connector) => connector.id === id));
  }

  async function update(id: string, input: UpdateConnectorInput) {
    const connector = await get(id);

    if (!connector) {
      throw new Error(`Connector ${id} was not found.`);
    }

    const updated: ConnectorConfig = {
      ...connector,
      ...input,
      launchConfig: redactLaunchConfig(input.launchConfig ?? connector.launchConfig),
      updatedAt: now()
    };

    database.run(
      `UPDATE connectors
       SET enabled = ?, mode = ?, authStatus = ?, healthStatus = ?, allowedAgents = ?, requiredApproval = ?, launchConfig = ?, lastError = ?, updatedAt = ?
       WHERE id = ?`,
      [
        updated.enabled ? 1 : 0,
        updated.mode,
        updated.authStatus,
        updated.healthStatus,
        JSON.stringify(updated.allowedAgents),
        updated.requiredApproval,
        JSON.stringify(updated.launchConfig),
        updated.lastError ? redactSecrets(updated.lastError) : null,
        updated.updatedAt,
        id
      ]
    );
    await persist();
    return updated;
  }

  async function setHealth(id: string, health: ConnectorHealth) {
    const connector = await get(id);

    if (!connector) {
      throw new Error(`Connector ${id} was not found.`);
    }

    const updated: ConnectorConfig = {
      ...connector,
      authStatus: health.authStatus ?? connector.authStatus,
      healthStatus: health.healthStatus,
      lastCheckedAt: now(),
      lastError: health.lastError ? redactSecrets(health.lastError) : undefined,
      updatedAt: now()
    };

    database.run(
      `UPDATE connectors SET authStatus = ?, healthStatus = ?, lastCheckedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?`,
      [updated.authStatus, updated.healthStatus, updated.lastCheckedAt ?? null, updated.lastError ?? null, updated.updatedAt, id]
    );
    await persist();
    return updated;
  }

  return {
    disconnect: (id) =>
      update(id, {
        enabled: false,
        authStatus: 'not_configured',
        healthStatus: 'unknown',
        lastError: undefined,
        launchConfig: {}
      }),
    get,
    list,
    setHealth,
    update
  };
}

function defaultConnectors(updatedAt: string): ConnectorConfig[] {
  return [
    createDefault('web-search', 'Web Search', 'web_search', updatedAt),
    createDefault('local-files', 'Local Files', 'local_files', updatedAt),
    createDefault('email', 'Email', 'email', updatedAt),
    createDefault('calendar', 'Calendar', 'calendar', updatedAt)
  ];
}

function createDefault(id: string, name: string, type: ConnectorType, updatedAt: string): ConnectorConfig {
  return {
    id,
    name,
    type,
    enabled: false,
    mode: 'real',
    authStatus: 'not_configured',
    healthStatus: 'unknown',
    allowedAgents: [],
    requiredApproval: type === 'local_files' ? 'preview_sensitive_actions' : 'preview_sensitive_actions',
    launchConfig: {},
    updatedAt
  };
}

function rowsToConnectors(rows: unknown[][]): ConnectorConfig[] {
  return rows.map((row) => ({
    id: String(row[0]),
    name: String(row[1]),
    type: row[2] as ConnectorType,
    enabled: Number(row[3]) === 1,
    mode: row[4] as ConnectorMode,
    authStatus: row[5] as ConnectorAuthStatus,
    healthStatus: row[6] as ConnectorHealthStatus,
    allowedAgents: JSON.parse(String(row[7])) as string[],
    requiredApproval: row[8] as ConnectorConfig['requiredApproval'],
    launchConfig: JSON.parse(String(row[9])) as ConnectorLaunchConfig,
    lastCheckedAt: row[10] ? String(row[10]) : undefined,
    lastError: row[11] ? String(row[11]) : undefined,
    updatedAt: String(row[12])
  }));
}

function redactLaunchConfig(config: ConnectorLaunchConfig): ConnectorLaunchConfig {
  return {
    ...config,
    args: config.args?.map((arg) => redactSecrets(arg)),
    env: config.env ? Object.fromEntries(Object.entries(config.env).map(([key, value]) => [key, redactSecrets(value)])) : undefined
  };
}

function orderFor(type: ConnectorType) {
  return ['web_search', 'local_files', 'email', 'calendar'].indexOf(type);
}
