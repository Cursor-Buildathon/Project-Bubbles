import { describe, expect, it } from 'vitest';
import { classifyIntent } from './intentClassifier.js';

describe('classifyIntent', () => {
  it.each([
    ['Help me plan my Bubbles MVP', 'general.plan', 'general-assistant'],
    ['Research the best way to connect MCP tools', 'research.web', 'research-agent'],
    ['do me a research on MiniMax Token Plans', 'research.web', 'research-agent'],
    ['search me Tavily MCP setup', 'research.web', 'research-agent'],
    ['Build this feature in my project', 'coding.project', 'coding-agent'],
    ['Create a coding agent for this project', 'agent.create', 'general-assistant'],
    ['Generate a friendly voice intro', 'creative.minimax', 'creative-minimax-helper'],
    ['Generate an image of a neon desk setup', 'creative.image', 'creative-minimax-helper'],
    ['Draw a picture of a glass greenhouse on Mars', 'creative.image', 'creative-minimax-helper'],
    ['Render an illustration of a tiny robot florist', 'creative.image', 'creative-minimax-helper'],
    ['Create a poster for a jazz night', 'creative.image', 'creative-minimax-helper'],
    ['Make a short song for a product launch', 'creative.music', 'creative-minimax-helper'],
    ['Build a landing page for my bakery', 'coding.landing_page', 'coding-agent']
  ])('classifies "%s"', (userText, taskType, agentId) => {
    expect(classifyIntent(userText)).toMatchObject({ taskType, suggestedAgentId: agentId });
  });

  it('does not route old email/calendar prompts into removed MCP connectors', () => {
    expect(classifyIntent('Read my last email')).toMatchObject({ taskType: 'general.plan' });
    expect(classifyIntent('Check my calendar tomorrow')).toMatchObject({ taskType: 'general.plan' });
  });
});
