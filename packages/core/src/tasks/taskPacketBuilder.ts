import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type AgentProfile, type MemoryItem, type TaskPacket, type TaskType } from '../shared/types.js';

export interface BuildTaskPacketOptions {
  activeAgentId?: string;
  approvalPolicy?: TaskPacket['approvalPolicy'];
  connectorContext?: Record<string, unknown>;
  memoryContext?: MemoryItem[];
  mode?: TaskPacket['mode'];
  projectRoot: string;
  taskType?: TaskType;
  userText: string;
}

export async function buildTaskPacket({
  activeAgentId = 'general-assistant',
  approvalPolicy = 'preview_sensitive_actions',
  connectorContext,
  memoryContext = [],
  mode = 'plan_then_act',
  projectRoot,
  taskType = 'general.plan',
  userText
}: BuildTaskPacketOptions): Promise<TaskPacket> {
  const agentPath = join(projectRoot, 'agents', activeAgentId, 'agent.json');
  const profile = JSON.parse(await readFile(agentPath, 'utf8')) as AgentProfile;
  const skillsPath = join(projectRoot, profile.skillsPath);
  const skillsMarkdown = await readFile(skillsPath, 'utf8');

  return {
    taskId: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userText,
    activeAgentId: profile.id,
    taskType,
    mode,
    memoryContext,
    skillsMarkdown,
    allowedTools: profile.allowedTools,
    connectorContext,
    approvalPolicy,
    outputPreference: {
      userLevel: 'nontechnical',
      responseStyle: 'clear_spoken_summary',
      includeTechnicalDetails: false
    }
  };
}
