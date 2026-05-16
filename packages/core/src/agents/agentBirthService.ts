import { type AgentBirthDraft } from '../shared/types.js';
import { containsVisualCustomization, validateAgentProfile } from './agentSchema.js';

type GenerateJson = (prompt: string) => Promise<unknown>;

interface AgentBirthServiceOptions {
  generateJson: GenerateJson;
  now?: () => string;
}

export interface AgentBirthService {
  preview: (request: string) => Promise<AgentBirthDraft>;
}

export function createAgentBirthService({
  generateJson,
  now = () => new Date().toISOString()
}: AgentBirthServiceOptions): AgentBirthService {
  return {
    async preview(request) {
      const response = await generateJson(createAgentBirthPrompt(request));
      const draft = normalizeDraft(response, now(), request);

      if (containsVisualCustomization(draft)) {
        throw new Error('Agent birth draft contains visual customization instructions.');
      }

      return draft;
    }
  };
}

function normalizeDraft(value: unknown, timestamp: string, request: string): AgentBirthDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Agent birth response must be an object.');
  }

  const draft = value as Record<string, unknown>;
  const profileInput =
    draft.profile && typeof draft.profile === 'object' && !Array.isArray(draft.profile)
      ? (draft.profile as Record<string, unknown>)
      : {};
  const name = normalizeString(profileInput.name, inferAgentName(request));
  const role = normalizeString(profileInput.role, `${name} assistant`);
  const badgeName = normalizeString(profileInput.badgeName, inferBadgeName(name));
  const id = normalizeAgentId({ ...profileInput, name });
  const profile = validateAgentProfile({
    ...profileInput,
    id,
    name,
    role,
    badgeName,
    voiceStyle: normalizeString(profileInput.voiceStyle, 'Clear and helpful'),
    responseStyle: normalizeString(profileInput.responseStyle, 'Concise, structured responses'),
    skillsPath: normalizeSkillsPath(profileInput, id),
    allowedTools: normalizeStringArray(profileInput.allowedTools, ['minimax.text']),
    memoryRules: normalizeStringArray(profileInput.memoryRules, ['Remember recurring user preferences.']),
    safetyRules: normalizeStringArray(profileInput.safetyRules, ['Ask before taking external or file-writing actions.']),
    createdAt: String(profileInput.createdAt ?? timestamp),
    updatedAt: timestamp
  });
  const skillsMarkdown =
    typeof draft.skillsMarkdown === 'string' && draft.skillsMarkdown.trim()
      ? draft.skillsMarkdown
      : createDefaultSkillsMarkdown(profile);

  return {
    profile,
    skillsMarkdown
  };
}

function createDefaultSkillsMarkdown(profile: AgentBirthDraft['profile']) {
  return [
    `# ${profile.name}`,
    '',
    `Role: ${profile.role}`,
    '',
    '## Operating Notes',
    '',
    '- Follow the active task checklist.',
    '- Keep findings concise and evidence-based.',
    '- Ask for approval before taking sensitive actions.'
  ].join('\n');
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeAgentId(profile: Record<string, unknown>) {
  const source = [profile.id, profile.name, profile.badgeName, profile.role].find(
    (value): value is string => typeof value === 'string' && Boolean(value.trim())
  );

  return slugify(source ?? 'custom-agent');
}

function inferAgentName(request: string) {
  return /\bqa\b/i.test(request) ? 'QA Agent' : 'Custom Agent';
}

function inferBadgeName(name: string) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'Agent';
}

function normalizeSkillsPath(profile: Record<string, unknown>, id: string) {
  const skillsPath = typeof profile.skillsPath === 'string' ? profile.skillsPath.trim() : '';

  if (skillsPath === `agents/${id}/skills.md`) {
    return skillsPath;
  }

  return `agents/${id}/skills.md`;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const strings = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));

    return strings.length > 0 ? strings : fallback;
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return fallback;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'custom-agent';
}

function createAgentBirthPrompt(request: string) {
  return [
    'Create a Bubbles agent draft as strict JSON.',
    'Return only: { "profile": AgentProfile, "skillsMarkdown": string }.',
    'Allowed profile fields: id, name, role, badgeName, voiceStyle, allowedTools, memoryRules, safetyRules, responseStyle, skillsPath, createdAt, updatedAt.',
    'Do not include visual style, avatar, color, theme, sprite, costume, prop, or appearance fields or instructions.',
    `User request: ${request}`
  ].join('\n');
}
