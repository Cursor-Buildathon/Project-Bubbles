import { type ApprovalRequest, type ArtifactMetadata, type AvatarState, type TaskType } from '../shared/types.js';
import { type TavilySearchResult } from '../connectors/tavilyResearchConnector.js';
import { type ResearchReport } from '../research/researchService.js';
import { classifyIntent, type IntentClassification } from './intentClassifier.js';

export type CreateApproval = (
  approval: Omit<ApprovalRequest, 'id' | 'risk' | 'status' | 'createdAt' | 'resolvedAt'>
) => Promise<ApprovalRequest>;

export interface FlowRouterInput {
  activeAgentId: string;
  userText: string;
}

export type FlowRouterResult =
  | {
      handled: true;
      taskType: TaskType;
      suggestedAgentId: string;
      avatarState: AvatarState;
      message: string;
      approvalId?: string;
      artifacts?: ArtifactMetadata[];
      citations?: TavilySearchResult[];
      speakOnArrival?: boolean;
      voiceText?: string;
    }
  | (IntentClassification & {
      handled: false;
    });

interface FlowRouterOptions {
  createApproval?: CreateApproval;
  creative?: {
    run: (request: { kind: 'image' | 'music' | 'video'; prompt: string }) => Promise<
      | {
          ok: true;
          text: string;
          artifact?: ArtifactMetadata;
        }
      | { ok: false; error: string }
    >;
  };
  research?: {
    run: (query: string) => Promise<{ ok: true; report: ResearchReport } | { ok: false; error: string }>;
  };
}

export function createFlowRouter({ createApproval, creative, research }: FlowRouterOptions = {}) {
  return {
    async route(input: FlowRouterInput): Promise<FlowRouterResult> {
      const intent = classifyIntent(input.userText);

      if (intent.taskType === 'research.web') {
        if (!research) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: 'Tavily Research is not connected. Add a Tavily API key in Connectors.'
          };
        }

        const response = await research.run(input.userText);

        if (!response.ok) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: response.error
          };
        }

        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'celebrating',
          citations: response.report.citations,
          message: response.report.text,
          voiceText: response.report.voiceText
        };
      }

      if (intent.taskType === 'creative.image' || intent.taskType === 'creative.music' || intent.taskType === 'creative.video') {
        if (!creative) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: 'MiniMax media generation is not ready yet.'
          };
        }

        const kind = creativeKindForTask(intent.taskType);
        const response = await creative.run({ kind, prompt: extractCreativePrompt(input.userText, kind) });

        if (!response.ok) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: response.error
          };
        }

        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'celebrating',
          artifacts: response.artifact ? [response.artifact] : undefined,
          message:
            kind === 'image'
              ? 'The image is ready. You can download it from the chat window.'
              : kind === 'video'
                ? 'The video is ready. You can download it from the chat window.'
              : 'The music is ready. You can listen or download it from the chat window.',
          speakOnArrival: kind === 'image' || kind === 'video' || kind === 'music',
          voiceText:
            kind === 'image' ? 'The image is ready.' : kind === 'video' ? 'The video is ready.' : 'The music is ready.'
        };
      }

      if (intent.taskType === 'coding.landing_page') {
        if (!createApproval) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: 'Landing-page sandbox approvals are not ready yet.'
          };
        }

        const approval = await createApproval({
          taskId: `task-landing-${Date.now()}`,
          agentId: intent.suggestedAgentId,
          actionType: 'shell_command',
          title: 'Generate landing page',
          explanation: 'Bubbles needs approval before generating files and running sandboxed build commands.',
          preview: {
            request: input.userText,
            sandboxed: true,
            workflow: ['generate MiniMax code', 'node scripts/accessibility-check.mjs', 'vite build', 'save to Downloads', 'serve locally', 'open browser']
          }
        });

        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'waiting_approval',
          approvalId: approval.id,
          message: 'I drafted a sandboxed build workflow. Please approve it before I generate and run the landing page.'
        };
      }

      if (intent.taskType === 'creative.minimax') {
        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'working',
          message: 'Creative MiniMax routing is ready. Connect MiniMax voice or media output in Settings to generate the final artifact.'
        };
      }

      if (intent.taskType === 'agent.create') {
        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'confused',
          message: 'Use Agent Birth in the Agents panel so I can show the agent files before asking approval to create them.'
        };
      }

      return {
        ...intent,
        handled: false
      };
    }
  };
}

function creativeKindForTask(taskType: 'creative.image' | 'creative.music' | 'creative.video') {
  if (taskType === 'creative.image') {
    return 'image';
  }

  if (taskType === 'creative.video') {
    return 'video';
  }

  return 'music';
}

function extractCreativePrompt(userText: string, kind: 'image' | 'music' | 'video'): string {
  const pattern =
    kind === 'image'
      ? /^(generate|make|create|draw|render)\s+(me\s+)?((an?|the)\s+)?(image|poster|logo|mockup|picture|illustration)\s+(of|for|about)?\s*/i
      : kind === 'video'
        ? /^(generate|make|create|render)\s+(me\s+)?((an?|the|short)\s+)?(video|clip|animation|short film|film)\s+(of|for|about)?\s*/i
        : /^(generate|make|create)\s+(a\s+)?(short\s+)?(music|song|track|audio|background music|theme)\s+(for|about)?\s*/i;
  const directPrompt = userText.replace(pattern, '').trim();

  if (directPrompt && directPrompt !== userText) {
    return directPrompt;
  }

  if (kind === 'image') {
    const trailingImagePrompt = userText.replace(/^(generate|make|create|draw|render)\s+(me\s+)?((an?|the)\s+)?/i, '').trim();
    return trailingImagePrompt || userText;
  }

  if (kind === 'video') {
    const trailingVideoPrompt = userText.replace(/^(generate|make|create|render)\s+(me\s+)?((an?|the|short)\s+)?/i, '').trim();
    return trailingVideoPrompt || userText;
  }

  const trailingMusicPrompt = userText.replace(/^(generate|make|create)\s+(me\s+)?((an?|the|short)\s+)?/i, '').trim();
  return trailingMusicPrompt || directPrompt || userText;
}
