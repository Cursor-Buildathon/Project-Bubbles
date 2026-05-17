import { describe, expect, it } from 'vitest';
import { classifyIntent } from './intentClassifier.js';

describe('classifyIntent', () => {
  it.each([
    ['Help me plan my Bubbles MVP', 'general.plan', 'general-assistant'],
    ['Research the best way to connect MCP tools', 'research.web', 'general-assistant'],
    ['do me a research on MiniMax Token Plans', 'research.web', 'general-assistant'],
    ['search me Tavily MCP setup', 'research.web', 'general-assistant'],
    ['Build this feature in my project', 'coding.project', 'general-assistant'],
    ['Create a coding agent for this project', 'agent.create', 'general-assistant'],
    ['Create an agent skill for invoice analysis', 'agent.create', 'general-assistant'],
    ['Generate a friendly voice intro', 'creative.minimax', 'general-assistant'],
    ['Generate an image of a neon desk setup', 'creative.image', 'general-assistant'],
    ['Draw a picture of a glass greenhouse on Mars', 'creative.image', 'general-assistant'],
    ['Render an illustration of a tiny robot florist', 'creative.image', 'general-assistant'],
    ['Create a poster for a jazz night', 'creative.image', 'general-assistant'],
    ['Make a short song for a product launch', 'creative.music', 'general-assistant'],
    ['create a guitar music', 'creative.music', 'general-assistant'],
    ['Generate a video of waves rolling over black sand', 'creative.video', 'general-assistant'],
    ['Render a short film about a lantern in the rain', 'creative.video', 'general-assistant'],
    ['Build a landing page for my bakery', 'coding.landing_page', 'general-assistant']
  ])('classifies "%s"', (userText, taskType, agentId) => {
    expect(classifyIntent(userText)).toMatchObject({ taskType, suggestedAgentId: agentId });
  });

  it('does not route old email/calendar prompts into removed MCP connectors', () => {
    expect(classifyIntent('Read my last email')).toMatchObject({ taskType: 'general.plan' });
    expect(classifyIntent('Check my calendar tomorrow')).toMatchObject({ taskType: 'general.plan' });
  });
});
