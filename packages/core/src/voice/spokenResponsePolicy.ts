import { type AffectTag } from './voiceTypes.js';

const DEFAULT_MAX_CHARACTERS = 50;
const CHAT_PANEL_RESPONSE_PROMPT = 'Please look in the chat panel for the response.';

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

  if (!shouldUseChatPanelPrompt(summary, maxCharacters)) {
    return {
      voiceText: summary,
      captionText: summary,
      summarized: false
    };
  }

  return {
    voiceText: CHAT_PANEL_RESPONSE_PROMPT,
    captionText: CHAT_PANEL_RESPONSE_PROMPT,
    summarized: true
  };
}

function shouldUseChatPanelPrompt(text: string, maxCharacters: number) {
  return text.length >= maxCharacters;
}

function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}
