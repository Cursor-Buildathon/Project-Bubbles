import { type ApprovalRequest, type ArtifactMetadata, type AvatarState, type TaskType } from '../shared/types.js';
import { type CalendarEventInput, type createCalendarConnector } from '../connectors/calendarConnector.js';
import { type createEmailConnector, type EmailDraftInput } from '../connectors/emailConnector.js';
import { type createWebSearchConnector, type WebSearchResult } from '../connectors/webSearchConnector.js';
import { type ConnectorConfig } from '../shared/types.js';
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
      citations?: WebSearchResult[];
    }
  | (IntentClassification & {
      handled: false;
    });

interface FlowRouterOptions {
  connectors?: {
    calendar?: ReturnType<typeof createCalendarConnector>;
    email?: Partial<Pick<ReturnType<typeof createEmailConnector>, 'createDraft' | 'latest' | 'sendDraft'>>;
    get?: (id: 'calendar' | 'email' | 'web-search') => Promise<ConnectorConfig | undefined>;
    webSearch?: ReturnType<typeof createWebSearchConnector>;
  };
  createApproval?: CreateApproval;
  creative?: {
    run: (request: { kind: 'image' | 'music'; prompt: string }) => Promise<
      | {
          ok: true;
          text: string;
          artifact?: ArtifactMetadata;
        }
      | { ok: false; error: string }
    >;
  };
}

export function createFlowRouter({ connectors, createApproval, creative }: FlowRouterOptions = {}) {
  return {
    async route(input: FlowRouterInput): Promise<FlowRouterResult> {
      const intent = classifyIntent(input.userText);

      if (intent.taskType === 'research.web') {
        const connector = await connectors?.get?.('web-search');

        if (connector && connectors?.webSearch) {
          const response = await connectors.webSearch.search(connector, input.userText, { maxResults: 5 });

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
            avatarState: 'working',
            message: formatResearchMessage(response.results),
            citations: response.results
          };
        }
      }

      if (intent.taskType === 'email.reply') {
        if (!createApproval) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: 'Email approvals are not ready yet.'
          };
        }

        const emailConnector = await connectors?.get?.('email');
        const draft =
          emailConnector && connectors?.email?.createDraft
            ? await connectors.email.createDraft(emailConnector, draftEmail(input.userText))
            : undefined;

        if (draft && !draft.ok) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: draft.error
          };
        }

        const approval = await createApproval({
          taskId: `task-email-${Date.now()}`,
          agentId: intent.suggestedAgentId,
          actionType: 'send_email',
          title: 'Send email',
          explanation: 'Bubbles drafted the reply and needs approval before sending.',
          preview: {
            body: input.userText.replace(/^reply\s+/i, ''),
            connectorId: 'email',
            draftId: draft?.draft.id,
            subject: 'Re: latest email',
            to: ['friend@example.com']
          }
        });

        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'waiting_approval',
          message: 'I drafted the reply. Please approve it before I send anything.',
          approvalId: approval.id
        };
      }

      if (intent.taskType === 'calendar.update') {
        if (!createApproval) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: 'Calendar approvals are not ready yet.'
          };
        }

        const calendarConnector = await connectors?.get?.('calendar');
        const suggestion =
          calendarConnector && connectors?.calendar
            ? await connectors.calendar.suggestTime(calendarConnector, { durationMinutes: 30, instruction: input.userText })
            : undefined;

        if (suggestion && !suggestion.ok) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: suggestion.error
          };
        }

        const eventInput = draftCalendarEvent(input.userText, suggestion?.suggestion);
        const approval = await createApproval({
          taskId: `task-calendar-${Date.now()}`,
          agentId: intent.suggestedAgentId,
          actionType: 'calendar_update',
          title: 'Update calendar',
          explanation: 'Bubbles drafted a calendar change and needs approval before applying it.',
          preview: {
            connectorId: 'calendar',
            operation: 'create_event',
            instruction: input.userText,
            oldEvent: {},
            newEvent: eventInput
          }
        });

        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'waiting_approval',
          message: 'I drafted the calendar update. Please approve it before I change anything.',
          approvalId: approval.id
        };
      }

      if (intent.taskType === 'email.read') {
        const emailConnector = await connectors?.get?.('email');

        if (emailConnector && connectors?.email?.latest) {
          const latest = await connectors.email.latest(emailConnector);

          if (!latest.ok) {
            return {
              handled: true,
              taskType: intent.taskType,
              suggestedAgentId: intent.suggestedAgentId,
              avatarState: 'concerned',
              message: latest.error
            };
          }

          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'working',
            message: `Latest email from ${latest.message.from}: ${latest.message.subject}. ${latest.message.body}`
          };
        }

        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'concerned',
          message: 'Email is not connected. Open Connectors and connect Gmail or Outlook.'
        };
      }

      if (intent.taskType === 'calendar.read') {
        const calendarConnector = await connectors?.get?.('calendar');

        if (calendarConnector && connectors?.calendar) {
          const events = await connectors.calendar.listTomorrow(calendarConnector);

          if (!events.ok) {
            return {
              handled: true,
              taskType: intent.taskType,
              suggestedAgentId: intent.suggestedAgentId,
              avatarState: 'concerned',
              message: events.error
            };
          }

          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'working',
            message: events.events.length
              ? `You have ${events.events.length} calendar item${events.events.length === 1 ? '' : 's'} tomorrow: ${events.events
                  .map((event) => event.title)
                  .join(', ')}.`
              : 'Your calendar is clear tomorrow.'
          };
        }

        return {
          handled: true,
          taskType: intent.taskType,
          suggestedAgentId: intent.suggestedAgentId,
          avatarState: 'concerned',
          message: 'Calendar is not connected. Open Connectors and connect Google or Outlook Calendar.'
        };
      }

      if (intent.taskType === 'creative.image' || intent.taskType === 'creative.music') {
        if (!creative) {
          return {
            handled: true,
            taskType: intent.taskType,
            suggestedAgentId: intent.suggestedAgentId,
            avatarState: 'concerned',
            message: 'MiniMax media generation is not ready yet.'
          };
        }

        const kind = intent.taskType === 'creative.image' ? 'image' : 'music';
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
              : 'The music is ready. You can listen in the chat window.'
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
            workflow: ['generate files', 'node scripts/accessibility-check.mjs', 'vite build', 'serve locally', 'open browser']
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

function extractCreativePrompt(userText: string, kind: 'image' | 'music'): string {
  const pattern =
    kind === 'image'
      ? /^(generate|make|create)\s+(an?\s+)?(image|poster|logo|mockup|picture|illustration)\s+(of|for|about)?\s*/i
      : /^(generate|make|create)\s+(a\s+)?(short\s+)?(music|song|track|audio|background music|theme)\s+(for|about)?\s*/i;
  return userText.replace(pattern, '').trim() || userText;
}

function formatResearchMessage(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return 'I searched, but no sources came back.';
  }

  const sourceLabel = results.length === 1 ? 'source' : 'sources';
  return `I found ${results.length} ${sourceLabel}: ${results.map((result) => result.title).join(', ')}.`;
}

function draftEmail(userText: string): EmailDraftInput {
  return {
    body: userText.replace(/^reply\s+/i, ''),
    subject: 'Re: latest email',
    to: ['friend@example.com']
  };
}

function draftCalendarEvent(userText: string, suggestion?: { endsAt: string; startsAt: string; timezone: string }): CalendarEventInput {
  return {
    endsAt: suggestion?.endsAt ?? '2026-05-15T10:30:00.000Z',
    startsAt: suggestion?.startsAt ?? '2026-05-15T10:00:00.000Z',
    timezone: suggestion?.timezone ?? 'Google Calendar default',
    title: userText
  };
}
