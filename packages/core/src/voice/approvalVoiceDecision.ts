import { type ApprovalVoiceDecision } from './voiceTypes.js';

interface ApprovalDecisionInput {
  approvalId: string;
  voiceTurnId: string;
  transcript: string;
}

interface ApprovalFallbackInput {
  attemptCount: number;
  approvalTitle: string;
}

const approvePhrases = [
  /\bapprove\b/i,
  /\byes\b/i,
  /\byep\b/i,
  /\byup\b/i,
  /\bdo it\b/i,
  /\bgo ahead\b/i,
  /\bok(?:ay)?\b/i,
  /\ballow\b/i,
  /\bconfirm\b/i,
  /\bproceed\b/i,
  /\bsure\b/i
];

const denyPhrases = [
  /\bdeny\b/i,
  /\bdecline\b/i,
  /\bno\b/i,
  /\bnope\b/i,
  /\bnah\b/i,
  /\bdon't\b/i,
  /\bdo not\b/i,
  /\breject\b/i,
  /\bstop\b/i
];
const cancelPhrases = [/\bcancel\b/i, /\bnever mind\b/i, /\bnevermind\b/i, /\bdismiss\b/i, /\babort\b/i, /\bforget it\b/i];

export function classifyApprovalVoiceDecision({
  approvalId,
  voiceTurnId,
  transcript
}: ApprovalDecisionInput): ApprovalVoiceDecision {
  const normalizedTranscript = transcript.trim();
  const decision = classifyTranscript(normalizedTranscript);

  return {
    approvalId,
    voiceTurnId,
    decision,
    transcript: normalizedTranscript,
    confidence: decision === 'unclear' ? 0.35 : 0.95
  };
}

export function createApprovalVoiceFallback({ attemptCount, approvalTitle }: ApprovalFallbackInput) {
  if (attemptCount < 2) {
    return `I did not catch that. Say approve, deny, or cancel for ${approvalTitle}.`;
  }

  return `I could not tell whether to approve ${approvalTitle}. Please use the approval buttons in chat.`;
}

function classifyTranscript(transcript: string): ApprovalVoiceDecision['decision'] {
  if (!transcript) {
    return 'unclear';
  }

  if (matchesAny(transcript, cancelPhrases)) {
    return 'cancelled';
  }

  if (matchesAny(transcript, denyPhrases)) {
    return 'denied';
  }

  if (/\bnot\s+sure\b/i.test(transcript)) {
    return 'unclear';
  }

  if (matchesAny(transcript, approvePhrases)) {
    return 'approved';
  }

  return 'unclear';
}

function matchesAny(transcript: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(transcript));
}
