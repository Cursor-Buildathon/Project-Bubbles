import { describe, expect, it } from 'vitest';
import { createFlowRouter } from './flowRouter.js';

describe('createFlowRouter', () => {
  it('leaves general MiniMax-backed tasks for the existing task runner', async () => {
    const router = createFlowRouter();

    await expect(router.route({ userText: 'Help me plan my MVP', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      handled: false,
      taskType: 'general.plan',
      suggestedAgentId: 'general-assistant'
    });
  });

  it('routes research prompts through Tavily and returns the report without forcing TTS narration', async () => {
    const router = createFlowRouter({
      research: {
        run: async () => ({
          ok: true,
          report: {
            citations: [{ title: 'Tavily MCP', url: 'https://tavily.com', snippet: 'Live search.' }],
            createdAt: '2026-05-16T10:00:00.000Z',
            id: 'research-1',
            query: 'do me a research on Tavily MCP',
            text: '## Executive Summary\nTavily MCP provides cited live search.',
            voiceText: 'Your research output is ready. I put the full report in chat.'
          }
        })
      }
    });

    await expect(
      router.route({ userText: 'do me a research on Tavily MCP', activeAgentId: 'general-assistant' })
    ).resolves.toMatchObject({
      citations: [{ title: 'Tavily MCP', url: 'https://tavily.com', snippet: 'Live search.' }],
      handled: true,
      message: '## Executive Summary\nTavily MCP provides cited live search.',
      taskType: 'research.web',
      voiceText: 'Your research output is ready. I put the full report in chat.'
    });
  });

  it('returns a Tavily setup message when research is unavailable', async () => {
    const router = createFlowRouter();

    await expect(router.route({ userText: 'search me MiniMax token plans', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      avatarState: 'concerned',
      handled: true,
      message: 'Tavily Research is not connected. Add a Tavily API key in Connectors.',
      taskType: 'research.web'
    });
  });

  it('routes image generation through the creative service, preserving the user idea for one-shot speech', async () => {
    let requestPrompt = '';
    const router = createFlowRouter({
      creative: {
        run: async (request) => {
          requestPrompt = request.prompt;
          return {
            ok: true,
            text: 'The image is ready.',
            artifact: { id: 'image-1', kind: 'image', path: '/tmp/image.svg' }
          };
        }
      }
    });

    await expect(
      router.route({ userText: 'Render an illustration of a tiny robot florist', activeAgentId: 'general-assistant' })
    ).resolves.toMatchObject({
      artifacts: [{ id: 'image-1', kind: 'image', path: '/tmp/image.svg' }],
      avatarState: 'celebrating',
      handled: true,
      message: 'The image is ready. You can download it from the chat window.',
      taskType: 'creative.image',
      voiceText: 'The image is ready.',
      speakOnArrival: true
    });
    expect(requestPrompt).toBe('a tiny robot florist');
  });

  it('strips the image command wrapper when the image noun appears at the end of the idea', async () => {
    let requestPrompt = '';
    const router = createFlowRouter({
      creative: {
        run: async (request) => {
          requestPrompt = request.prompt;
          return {
            ok: true,
            text: 'The image is ready.',
            artifact: { id: 'image-1', kind: 'image', path: '/tmp/image.svg' }
          };
        }
      }
    });

    await router.route({ userText: 'create a calm beach image', activeAgentId: 'general-assistant' });

    expect(requestPrompt).toBe('calm beach image');
  });

  it('routes music generation through the creative service and returns an audio artifact', async () => {
    const router = createFlowRouter({
      creative: {
        run: async () => ({
          ok: true,
          text: 'The music is ready.',
          artifact: { id: 'audio-1', kind: 'audio', path: '/tmp/music.mp3' }
        })
      }
    });

    await expect(router.route({ userText: 'Make a short song for launch', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      artifacts: [{ id: 'audio-1', kind: 'audio', path: '/tmp/music.mp3' }],
      avatarState: 'celebrating',
      handled: true,
      message: 'The music is ready. You can listen in the chat window.',
      taskType: 'creative.music'
    });
  });

  it('routes video generation through the creative service with one-shot speech metadata', async () => {
    let requestPrompt = '';
    const router = createFlowRouter({
      creative: {
        run: async (request) => {
          requestPrompt = request.prompt;
          return {
            ok: true,
            text: 'The video is ready.',
            artifact: { id: 'video-1', kind: 'video', path: '/tmp/video.mp4' }
          };
        }
      }
    });

    await expect(
      router.route({ userText: 'Generate a video of waves rolling over black sand', activeAgentId: 'general-assistant' })
    ).resolves.toMatchObject({
      artifacts: [{ id: 'video-1', kind: 'video', path: '/tmp/video.mp4' }],
      avatarState: 'celebrating',
      handled: true,
      message: 'The video is ready. You can download it from the chat window.',
      taskType: 'creative.video',
      voiceText: 'The video is ready.',
      speakOnArrival: true
    });
    expect(requestPrompt).toBe('waves rolling over black sand');
  });

  it('routes landing-page requests into an approval-gated sandbox workflow', async () => {
    const approvals: unknown[] = [];
    const router = createFlowRouter({
      createApproval: async (approval) => {
        approvals.push(approval);
        return {
          id: 'approval-site',
          status: 'pending',
          risk: 'high',
          createdAt: '2026-05-14T00:00:00.000Z',
          ...approval
        };
      }
    });

    await expect(router.route({ userText: 'Build a landing page for my bakery', activeAgentId: 'general-assistant' })).resolves.toMatchObject({
      approvalId: 'approval-site',
      avatarState: 'waiting_approval',
      handled: true,
      message: 'I drafted a sandboxed build workflow. Please approve it before I generate and run the landing page.',
      taskType: 'coding.landing_page'
    });
    expect(approvals[0]).toMatchObject({
      actionType: 'shell_command',
      preview: {
        sandboxed: true,
        workflow: ['generate files', 'node scripts/accessibility-check.mjs', 'vite build', 'serve locally', 'open browser']
      }
    });
  });
});
