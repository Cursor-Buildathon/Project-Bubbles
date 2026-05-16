import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { type ApprovalRequest, type ConnectorConfig } from '../shared/types.js';

export type LocalFileReadResponse = { ok: true; content: string } | { ok: false; error: string };

export function createLocalFilesConnector() {
  return {
    async read(config: ConnectorConfig, path: string): Promise<LocalFileReadResponse> {
      if (!isApprovedPath(config, path)) {
        return { ok: false, error: 'File is outside approved folders.' };
      }

      return {
        ok: true,
        content: await readFile(path, 'utf8')
      };
    },

    async prepareWrite(config: ConnectorConfig, path: string, nextContent: string): Promise<Omit<ApprovalRequest, 'id' | 'risk' | 'status' | 'createdAt' | 'resolvedAt'>> {
      if (!isApprovedPath(config, path)) {
        throw new Error('File is outside approved folders.');
      }

      return {
        taskId: `task-file-${Date.now()}`,
        agentId: config.allowedAgents[0] ?? 'coding-agent',
        actionType: 'file_write',
        title: 'Write file',
        explanation: 'Bubbles needs your approval before changing this file.',
        preview: {
          path,
          nextContent
        }
      };
    }
  };
}

function isApprovedPath(config: ConnectorConfig, path: string) {
  const target = resolve(path);
  return (config.launchConfig.approvedRoots ?? []).some((root) => {
    const approvedRoot = resolve(root);
    const relation = relative(approvedRoot, target);
    return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation));
  });
}
