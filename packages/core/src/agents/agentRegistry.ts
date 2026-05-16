import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type AgentBirthDraft, type AgentProfile } from '../shared/types.js';
import { validateAgentProfile } from './agentSchema.js';

interface AgentRegistryOptions {
  agentsRoot: string;
  defaultAgentId?: string;
  now?: () => string;
}

export interface AgentRegistry {
  activate: (agentId: string) => Promise<AgentProfile>;
  archive: (agentId: string) => Promise<AgentProfile>;
  create: (draft: AgentBirthDraft) => Promise<AgentProfile>;
  getActive: () => Promise<AgentProfile>;
  initialize: () => Promise<void>;
  list: () => Promise<AgentProfile[]>;
  load: (agentId: string) => Promise<AgentProfile>;
}

export function createAgentRegistry({
  agentsRoot,
  defaultAgentId = 'general-assistant',
  now = () => new Date().toISOString()
}: AgentRegistryOptions): AgentRegistry {
  let activeAgentId = defaultAgentId;

  async function list() {
    await mkdir(agentsRoot, { recursive: true });
    const entries = await readdir(agentsRoot, { withFileTypes: true });
    const profiles = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          try {
            return await load(entry.name);
          } catch {
            return undefined;
          }
        })
    );

    return profiles
      .filter((profile): profile is AgentProfile => Boolean(profile && !profile.archivedAt))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async function load(agentId: string) {
    const raw = await readFile(join(agentsRoot, agentId, 'agent.json'), 'utf8');
    return validateAgentProfile(JSON.parse(raw));
  }

  async function create(draft: AgentBirthDraft) {
    const profile = validateAgentProfile(draft.profile);
    const agentDir = join(agentsRoot, profile.id);
    await mkdir(agentDir, { recursive: true });
    await writeFile(join(agentDir, 'agent.json'), `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
    await writeFile(join(agentDir, 'skills.md'), draft.skillsMarkdown.trimEnd() + '\n', 'utf8');
    activeAgentId = profile.id;
    return profile;
  }

  async function activate(agentId: string) {
    const profile = await load(agentId);

    if (profile.archivedAt) {
      throw new Error(`Agent "${agentId}" is archived.`);
    }

    activeAgentId = profile.id;
    return profile;
  }

  async function archive(agentId: string) {
    const profile = await load(agentId);

    if (profile.id === defaultAgentId) {
      throw new Error('The default agent cannot be archived.');
    }

    const archived = validateAgentProfile({
      ...profile,
      archivedAt: now(),
      updatedAt: now()
    });
    await writeFile(join(agentsRoot, agentId, 'agent.json'), `${JSON.stringify(archived, null, 2)}\n`, 'utf8');

    if (activeAgentId === agentId) {
      activeAgentId = defaultAgentId;
    }

    return archived;
  }

  return {
    activate,
    archive,
    create,
    async getActive() {
      try {
        return await load(activeAgentId);
      } catch {
        activeAgentId = defaultAgentId;
        return load(defaultAgentId);
      }
    },
    async initialize() {
      const agents = await list();

      if (!agents.some((agent) => agent.id === activeAgentId)) {
        activeAgentId = agents[0]?.id ?? defaultAgentId;
      }
    },
    list,
    load
  };
}
