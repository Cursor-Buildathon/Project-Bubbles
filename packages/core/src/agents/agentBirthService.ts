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

export function createRecommendedAgentBirthDraft(request: string, timestamp = new Date().toISOString()): AgentBirthDraft {
  return normalizeDraft({}, timestamp, request);
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
  const agentMarkdown =
    typeof draft.agentMarkdown === 'string' && draft.agentMarkdown.trim()
      ? draft.agentMarkdown
      : createDefaultAgentMarkdown(profile);

  return {
    profile,
    agentMarkdown,
    skillsMarkdown
  };
}

function createDefaultAgentMarkdown(profile: AgentBirthDraft['profile']) {
  return [
    `# ${profile.name}`,
    '',
    `Role: ${profile.role}`,
    '',
    '## Recommended Profile',
    '',
    `- Badge: ${profile.badgeName}`,
    `- Voice style: ${profile.voiceStyle}`,
    `- Response style: ${profile.responseStyle}`,
    `- Allowed tools: ${profile.allowedTools.join(', ')}`,
    '',
    '## Boundaries',
    '',
    '- Stay focused on the requested specialty.',
    '- Explain uncertainty before recommending action.',
    '- Ask for approval before writing files or using external services.'
  ].join('\n');
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
    '- Ask for approval before taking sensitive actions.',
    '',
    '## Response Pattern',
    '',
    '- Start with the direct answer or current status.',
    '- List next actions only when they help the user decide.',
    '- Close with the smallest useful handoff.'
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
  const explicitAgentMatch = request.match(/\b(?:create|build|make|birth)\s+(?:a|an|the)?\s*([a-z0-9][a-z0-9 -]{0,40}?)\s+agent\b/i);
  const descriptor = explicitAgentMatch?.[1]?.trim();

  if (descriptor && !/^(new|custom|demo)$/i.test(descriptor)) {
    return `${titleCaseAgentDescriptor(descriptor)} Agent`;
  }

  const skillMatch = request.match(/\bagent skill\s+(?:for|to|that)?\s*([a-z0-9][a-z0-9 -]{0,40})/i);
  const skillDescriptor = skillMatch?.[1]?.trim();

  if (skillDescriptor) {
    return `${titleCaseAgentDescriptor(skillDescriptor)} Agent`;
  }

  return 'Custom Agent';
}

function inferBadgeName(name: string) {
  const subject = name.replace(/\bagent\b/gi, '').trim() || name;
  const shortSubject = subject.replace(/\s+/g, '');

  if (/^[a-z0-9]{1,3}$/i.test(shortSubject)) {
    return shortSubject.toUpperCase();
  }

  const initials = subject
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

function titleCaseAgentDescriptor(value: string) {
  return value
    .replace(/\bagent\b/gi, '')
    .trim()
    .split(/\s+/)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`))
    .join(' ');
}

function createAgentBirthPrompt(request: string) {
  return [
    'Create a Bubbles agent draft as strict JSON.',
    'Return only: { "profile": AgentProfile, "agentMarkdown": string, "skillsMarkdown": string }.',
    'Allowed profile fields: id, name, role, badgeName, voiceStyle, allowedTools, memoryRules, safetyRules, responseStyle, skillsPath, createdAt, updatedAt.',
    'Write agentMarkdown as a concise Markdown profile explaining the recommended agent role, boundaries, and operating style.',
    'Write skillsMarkdown as the operational skills and instructions for this agent.',
    'Do not include visual style, avatar, color, theme, sprite, costume, prop, or appearance fields or instructions.',
    `User request: ${request}`
  ].join('\n');
}
