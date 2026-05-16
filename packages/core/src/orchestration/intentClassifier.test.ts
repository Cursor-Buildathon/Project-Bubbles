import { describe, expect, it } from 'vitest';
import { classifyIntent } from './intentClassifier.js';

describe('classifyIntent', () => {
  it.each([
    ['Help me plan my Bubbles MVP', 'general.plan', 'general-assistant'],
    ['Research the best way to connect MCP tools', 'research.web', 'research-agent'],
    ['Build this feature in my project', 'coding.project', 'coding-agent'],
    ['Read my last email', 'email.read', 'email-calendar-assistant'],
    ['Reply that I can join', 'email.reply', 'email-calendar-assistant'],
    ['Check my calendar tomorrow', 'calendar.read', 'email-calendar-assistant'],
    ['Move my 3pm meeting to Friday', 'calendar.update', 'email-calendar-assistant'],
    ['Create a coding agent for this project', 'agent.create', 'general-assistant'],
    ['Generate a friendly voice intro', 'creative.minimax', 'creative-minimax-helper'],
    ['Generate an image of a neon desk setup', 'creative.image', 'creative-minimax-helper'],
    ['Make a short song for a product launch', 'creative.music', 'creative-minimax-helper'],
    ['Build a landing page for my bakery', 'coding.landing_page', 'coding-agent']
  ])('classifies "%s"', (userText, taskType, agentId) => {
    expect(classifyIntent(userText)).toMatchObject({ taskType, suggestedAgentId: agentId });
  });
});
