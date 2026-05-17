import { type TavilySearchResult } from '../connectors/tavilyResearchConnector.js';
import { redactSecrets } from '../security/redactSecrets.js';

export interface ResearchReport {
  id: string;
  query: string;
  text: string;
  citations: TavilySearchResult[];
  createdAt: string;
  voiceText: string;
}

interface ResearchServiceOptions {
  generateText: (prompt: string) => Promise<string>;
  now?: () => string;
}

export function createResearchService({ generateText, now = () => new Date().toISOString() }: ResearchServiceOptions) {
  return {
    async createReport(input: {
      extractedContent?: string[];
      query: string;
      results: TavilySearchResult[];
    }): Promise<ResearchReport> {
      if (!input.results.length) {
        return {
          citations: [],
          createdAt: now(),
          id: createResearchId(),
          query: input.query,
          text: 'I searched, but Tavily did not return any usable sources.',
          voiceText: readyVoiceText()
        };
      }

      const text = await generateText(buildResearchPrompt(input.query, input.results, input.extractedContent ?? []));
      return {
        citations: input.results,
        createdAt: now(),
        id: createResearchId(),
        query: input.query,
        text: normalizeReport(text),
        voiceText: readyVoiceText()
      };
    },

    async answerFollowUp(input: { question: string; report: ResearchReport }): Promise<ResearchReport> {
      const text = await generateText(buildFollowUpPrompt(input.question, input.report));
      return {
        citations: input.report.citations,
        createdAt: now(),
        id: input.report.id,
        query: input.report.query,
        text: normalizeReport(text),
        voiceText: readyVoiceText()
      };
    }
  };
}

export function isResearchPrompt(text: string) {
  return /\b(do me a research|do research|research|search me|search for|search|look up|investigate|find sources?)\b/i.test(text);
}

export function isReadResearchPrompt(text: string) {
  return /\b(read|speak|say|tell me aloud|read aloud)\b.*\b(output|report|research|result|answer)\b/i.test(text);
}

export function isResearchFollowUp(text: string) {
  return /\?$|^(what|why|how|which|who|when|where|can you|could you|explain|summarize|compare|continue)\b/i.test(text.trim());
}

export function readyVoiceText() {
  return 'Your research output is ready. I put the full report in chat.';
}

function buildResearchPrompt(query: string, results: TavilySearchResult[], extractedContent: string[]) {
  return `You are Bubbles, a desktop research assistant. Create a comprehensive but readable research report for the user.

User request:
${query}

Sources:
${results
  .map(
    (result, index) => `${index + 1}. ${result.title}
URL: ${result.url}
Snippet: ${result.snippet}`
  )
  .join('\n\n')}

Extracted source details:
${extractedContent.map((content, index) => `Extract ${index + 1}: ${content.slice(0, 3000)}`).join('\n\n') || 'No extracted page details.'}

Write in this exact section style:
## Executive Summary
## Key Findings
## Detailed Analysis
## Sources
## Suggested Follow-Up Questions

Use citations inline as source numbers like [1]. Do not invent sources.`;
}

function buildFollowUpPrompt(question: string, report: ResearchReport) {
  return `Answer the user's follow-up using only this previous research report and its sources unless the report explicitly lacks the answer.

Follow-up question:
${question}

Previous research report:
${report.text}

Sources:
${report.citations.map((citation, index) => `${index + 1}. ${citation.title}: ${citation.url}`).join('\n')}

Give a helpful answer and cite source numbers where relevant.`;
}

function normalizeReport(text: string) {
  return redactSecrets(text.trim()) || 'The research output is ready, but the synthesis was empty.';
}

function createResearchId() {
  return `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
