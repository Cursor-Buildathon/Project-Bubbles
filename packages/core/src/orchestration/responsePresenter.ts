import { type TaskType } from '../shared/types.js';
import { type AffectTag } from '../voice/voiceTypes.js';
import { prepareSpokenResponse } from '../voice/spokenResponsePolicy.js';

export interface SourceReference {
  title: string;
  url: string;
}

export interface PresentResponseInput {
  taskType: TaskType;
  status: 'completed' | 'blocked' | 'needs_approval' | 'failed';
  summary: string;
  nextStep?: string;
  sources?: SourceReference[];
  uncertainty?: string;
  affect?: AffectTag;
}

export interface PresentedResponse {
  text: string;
  voiceText: string;
  captionText: string;
  voiceStyle?: AffectTag['ttsStyle'];
  voiceSummarized: boolean;
  status: PresentResponseInput['status'];
}

export function presentResponse(input: PresentResponseInput): PresentedResponse {
  const sections = [input.summary];

  if (input.sources?.length) {
    sections.push(`Sources:\n${input.sources.map((source) => `- ${source.title}: ${source.url}`).join('\n')}`);
  }

  if (input.uncertainty) {
    sections.push(`Uncertainty: ${input.uncertainty}`);
  }

  if (input.nextStep) {
    sections.push(`Next step: ${input.nextStep}`);
  }

  const spoken = prepareSpokenResponse({
    chatText: sections.join('\n\n'),
    summary: input.summary,
    affect: input.affect
  });

  return {
    text: sections.join('\n\n'),
    voiceText: spoken.voiceText,
    captionText: spoken.captionText,
    voiceStyle: input.affect?.ttsStyle,
    voiceSummarized: spoken.summarized,
    status: input.status
  };
}
