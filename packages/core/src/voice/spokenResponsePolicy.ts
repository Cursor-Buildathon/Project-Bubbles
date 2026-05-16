import { type AffectTag } from './voiceTypes.js';

const DEFAULT_MAX_CHARACTERS = 280;
const DEFAULT_MAX_WORDS = 40;
const FULL_DETAILS_SUFFIX = 'I put the full details in chat.';

interface PrepareSpokenResponseInput {
  chatText: string;
  summary: string;
  affect?: AffectTag;
  maxCharacters?: number;
  maxWords?: number;
}

export interface PreparedSpokenResponse {
  voiceText: string;
  captionText: string;
  summarized: boolean;
}

export function prepareSpokenResponse(input: PrepareSpokenResponseInput): PreparedSpokenResponse {
  const summary = normalizeWhitespace(input.summary);
  const maxCharacters = input.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const maxWords = input.maxWords ?? DEFAULT_MAX_WORDS;

  const affectPrefix = spokenAffectPrefix(input.affect);

  if (!shouldSummarize(summary, maxCharacters, maxWords)) {
    const voiceText = `${affectPrefix}${summary}`;
    return {
      voiceText,
      captionText: voiceText,
      summarized: false
    };
  }

  const shortVersion = firstSentences(summary, 2);
  const voiceText = `${affectPrefix}Short version: ${shortVersion} ${FULL_DETAILS_SUFFIX}`;

  return {
    voiceText,
    captionText: voiceText,
    summarized: true
  };
}

function shouldSummarize(text: string, maxCharacters: number, maxWords: number) {
  return text.length > maxCharacters || wordCount(text) > maxWords;
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function firstSentences(text: string, sentenceCount: number) {
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()) ?? [];

  if (sentences.length >= sentenceCount) {
    return sentences.slice(0, sentenceCount).join(' ');
  }

  return text.split(/\s+/).slice(0, DEFAULT_MAX_WORDS).join(' ');
}

function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

function spokenAffectPrefix(affect: AffectTag | undefined) {
  if (!affect || affect.confidence < 0.6) {
    return '';
  }

  if (affect.primary === 'frustrated') {
    return 'I hear the frustration. ';
  }

  if (affect.primary === 'urgent') {
    return "I'll keep this brief. ";
  }

  if (affect.primary === 'stuck') {
    return "Let's get you unstuck. ";
  }

  if (affect.primary === 'confused') {
    return "Let's make this clearer. ";
  }

  return '';
}
