import { type AgentProfile } from '../shared/types.js';

const requiredStringFields = [
  'id',
  'name',
  'role',
  'badgeName',
  'voiceStyle',
  'responseStyle',
  'skillsPath',
  'createdAt',
  'updatedAt'
] as const;

const requiredStringArrayFields = ['allowedTools', 'memoryRules', 'safetyRules'] as const;

const allowedFields = new Set<string>([
  ...requiredStringFields,
  ...requiredStringArrayFields,
  'archivedAt'
]);

const visualTerms = ['color', 'theme', 'sprite', 'costume', 'prop', 'avatarstyle', 'appearance'];

export function validateAgentProfile(value: unknown): AgentProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Agent profile must be an object.');
  }

  const profile = value as Record<string, unknown>;
  const forbiddenField = Object.keys(profile).find((field) => isVisualTerm(field));

  if (forbiddenField) {
    throw new Error(`Agent profile contains visual customization field "${forbiddenField}".`);
  }

  const unknownField = Object.keys(profile).find((field) => !allowedFields.has(field));

  if (unknownField) {
    throw new Error(`Agent profile contains unsupported field "${unknownField}".`);
  }

  for (const field of requiredStringFields) {
    if (typeof profile[field] !== 'string' || !profile[field].trim()) {
      throw new Error(`Agent profile field "${field}" must be a non-empty string.`);
    }
  }

  for (const field of requiredStringArrayFields) {
    if (!Array.isArray(profile[field]) || !(profile[field] as unknown[]).every((item) => typeof item === 'string')) {
      throw new Error(`Agent profile field "${field}" must be a string array.`);
    }
  }

  if (profile.archivedAt !== undefined && typeof profile.archivedAt !== 'string') {
    throw new Error('Agent profile field "archivedAt" must be a string when present.');
  }

  if (!String(profile.skillsPath).startsWith(`agents/${profile.id}/`) || !String(profile.skillsPath).endsWith('/skills.md')) {
    throw new Error('Agent profile skillsPath must point to its own agents/<id>/skills.md file.');
  }

  return profile as unknown as AgentProfile;
}

export function containsVisualCustomization(value: unknown): boolean {
  if (typeof value === 'string') {
    return visualTerms.some((term) => value.toLowerCase().includes(term));
  }

  if (Array.isArray(value)) {
    return value.some(containsVisualCustomization);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, nested]) => isVisualTerm(key) || containsVisualCustomization(nested));
  }

  return false;
}

function isVisualTerm(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
  return visualTerms.includes(normalized);
}
