import { type ApprovalRequest } from '../shared/types.js';
import { type MemoryStore } from '../memory/memoryStore.js';
import { type TimelineStore } from '../timeline/timelineStore.js';
import { redactSecrets } from '../security/redactSecrets.js';
import { openSqliteDatabase } from '../shared/sqliteDatabase.js';
import { classifyApprovalRisk } from './riskClassifier.js';

const schemaSql = `
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  agentId TEXT NOT NULL,
  actionType TEXT NOT NULL,
  risk TEXT NOT NULL,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  preview TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  resolvedAt TEXT
);
`;

export type CreateApprovalInput = Omit<ApprovalRequest, 'id' | 'risk' | 'status' | 'createdAt' | 'resolvedAt'> & {
  id?: string;
  risk?: ApprovalRequest['risk'];
  createdAt?: string;
};

export interface ApprovalService {
  approve: (id: string) => Promise<ApprovalRequest>;
  cancel: (id: string) => Promise<ApprovalRequest>;
  create: (input: CreateApprovalInput) => Promise<ApprovalRequest>;
  deny: (id: string) => Promise<ApprovalRequest>;
  get: (id: string) => Promise<ApprovalRequest | undefined>;
  list: () => Promise<ApprovalRequest[]>;
  requireApproved: (id: string) => Promise<ApprovalRequest>;
}

interface ApprovalServiceOptions {
  databasePath: string;
  memoryStore?: MemoryStore;
  now?: () => string;
  timelineStore?: TimelineStore;
}

export async function createApprovalService({
  databasePath,
  memoryStore,
  now = () => new Date().toISOString(),
  timelineStore
}: ApprovalServiceOptions): Promise<ApprovalService> {
  const { database, persist } = await openSqliteDatabase(databasePath, schemaSql);

  async function create(input: CreateApprovalInput): Promise<ApprovalRequest> {
    const createdAt = input.createdAt ?? now();
    const approval: ApprovalRequest = {
      ...input,
      id: input.id ?? `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      risk: input.risk ?? classifyApprovalRisk(input.actionType),
      preview: redactPreview(input.preview),
      status: 'pending',
      createdAt
    };

    database.run(
      `INSERT INTO approvals (id, taskId, agentId, actionType, risk, title, explanation, preview, status, createdAt, resolvedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        approval.id,
        approval.taskId,
        approval.agentId,
        approval.actionType,
        approval.risk,
        approval.title,
        approval.explanation,
        JSON.stringify(approval.preview),
        approval.status,
        approval.createdAt,
        null
      ]
    );
    await persist();
    return approval;
  }

  async function list() {
    return rowsToApprovals(database.exec('SELECT * FROM approvals ORDER BY createdAt DESC')[0]?.values ?? []);
  }

  async function get(id: string) {
    return list().then((approvals) => approvals.find((approval) => approval.id === id));
  }

  async function resolve(id: string, status: ApprovalRequest['status']) {
    const approval = await get(id);

    if (!approval) {
      throw new Error(`Approval ${id} was not found.`);
    }

    if (approval.status !== 'pending') {
      return approval;
    }

    const resolvedApproval: ApprovalRequest = {
      ...approval,
      status,
      resolvedAt: now()
    };

    database.run('UPDATE approvals SET status = ?, resolvedAt = ? WHERE id = ?', [
      resolvedApproval.status,
      resolvedApproval.resolvedAt ?? null,
      resolvedApproval.id
    ]);
    await persist();
    await persistApprovalHistory(resolvedApproval);
    return resolvedApproval;
  }

  async function requireApproved(id: string) {
    const approval = await get(id);

    if (!approval) {
      throw new Error(`Approval ${id} was not found.`);
    }

    if (approval.status === 'approved') {
      return approval;
    }

    if (approval.status === 'denied') {
      throw new Error('Approval was denied.');
    }

    if (approval.status === 'cancelled') {
      throw new Error('Approval was cancelled.');
    }

    throw new Error('Approval is pending.');
  }

  async function persistApprovalHistory(approval: ApprovalRequest) {
    await timelineStore?.append({
      type: 'approval_decision',
      title: `Approval ${approval.status}`,
      summary: `${approval.title} was ${approval.status}.`,
      taskId: approval.taskId,
      agentId: approval.agentId,
      metadata: {
        approvalId: approval.id,
        actionType: approval.actionType,
        risk: approval.risk,
        status: approval.status
      }
    });
    await memoryStore?.create({
      type: 'approval_history',
      content: `${approval.title} was ${approval.status}.`,
      sourceTaskId: approval.taskId,
      agentId: approval.agentId,
      tags: ['approval', approval.actionType, approval.status],
      importance: approval.risk === 'high' ? 4 : 3
    });
  }

  return {
    approve: (id) => resolve(id, 'approved'),
    cancel: (id) => resolve(id, 'cancelled'),
    create,
    deny: (id) => resolve(id, 'denied'),
    get,
    list,
    requireApproved
  };
}

function redactPreview(value: unknown): Record<string, unknown> {
  const redacted = redactValue(value);
  return redacted && typeof redacted === 'object' && !Array.isArray(redacted) ? (redacted as Record<string, unknown>) : {};
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, redactValue(nestedValue)]));
  }

  return value;
}

function rowsToApprovals(rows: unknown[][]): ApprovalRequest[] {
  return rows.map((row) => ({
    id: String(row[0]),
    taskId: String(row[1]),
    agentId: String(row[2]),
    actionType: row[3] as ApprovalRequest['actionType'],
    risk: row[4] as ApprovalRequest['risk'],
    title: String(row[5]),
    explanation: String(row[6]),
    preview: JSON.parse(String(row[7])) as Record<string, unknown>,
    status: row[8] as ApprovalRequest['status'],
    createdAt: String(row[9]),
    resolvedAt: row[10] ? String(row[10]) : undefined
  }));
}
