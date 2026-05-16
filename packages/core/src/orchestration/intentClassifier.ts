import { type TaskType } from '../shared/types.js';

export interface IntentClassification {
  taskType: TaskType;
  suggestedAgentId: string;
  confidence: number;
}

export function classifyIntent(userText: string): IntentClassification {
  const text = userText.toLowerCase();

  if (/\b(reply|respond|send)\b.*\b(email|mail|join|available|can)\b/.test(text) || /^reply\b/.test(text)) {
    return intent('email.reply', 'email-calendar-assistant', 0.86);
  }

  if (/\b(read|latest|last|inbox|email|mail)\b/.test(text) && /\b(email|mail|inbox)\b/.test(text)) {
    return intent('email.read', 'email-calendar-assistant', 0.88);
  }

  if (/\b(move|reschedule|update|create|book|cancel)\b.*\b(meeting|calendar|event|appointment)\b/.test(text)) {
    return intent('calendar.update', 'email-calendar-assistant', 0.84);
  }

  if (/\b(calendar|schedule|meeting|meetings|agenda)\b/.test(text)) {
    return intent('calendar.read', 'email-calendar-assistant', 0.85);
  }

  if (/\b(create|build|make|birth)\b.*\bagent\b/.test(text)) {
    return intent('agent.create', 'general-assistant', 0.86);
  }

  if (/\b(generate|make|create)\b.*\b(image|poster|logo|mockup|picture|illustration)\b/.test(text)) {
    return intent('creative.image', 'creative-minimax-helper', 0.86);
  }

  if (/\b(generate|make|create)\b.*\b(music|song|track|audio|background music|theme)\b/.test(text)) {
    return intent('creative.music', 'creative-minimax-helper', 0.84);
  }

  if (/\b(build|make|create|generate)\b.*\b(landing page|webpage|web page|site|website)\b/.test(text)) {
    return intent('coding.landing_page', 'coding-agent', 0.84);
  }

  if (/\b(voice|tts|audio|image|vision|music|song|generate)\b/.test(text)) {
    return intent('creative.minimax', 'creative-minimax-helper', 0.78);
  }

  if (/\b(research|search|sources?|best way|look up|investigate)\b/.test(text)) {
    return intent('research.web', 'research-agent', 0.82);
  }

  if (/\b(code|coding|build|implement|fix|project|feature|repo)\b/.test(text)) {
    return intent('coding.project', 'coding-agent', 0.76);
  }

  return intent('general.plan', 'general-assistant', 0.7);
}

function intent(taskType: TaskType, suggestedAgentId: string, confidence: number): IntentClassification {
  return {
    taskType,
    suggestedAgentId,
    confidence
  };
}
