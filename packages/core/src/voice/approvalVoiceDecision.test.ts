import { describe, expect, it } from 'vitest';
import { classifyApprovalVoiceDecision, createApprovalVoiceFallback } from './approvalVoiceDecision.js';

describe('classifyApprovalVoiceDecision', () => {
  it('classifies spoken approve, deny, and cancel phrases', () => {
    expect(classifyApprovalVoiceDecision({ approvalId: 'approval-1', voiceTurnId: 'voice-1', transcript: 'yes, approve it' })).toMatchObject({
      approvalId: 'approval-1',
      voiceTurnId: 'voice-1',
      decision: 'approved',
      confidence: 0.95
    });
    expect(classifyApprovalVoiceDecision({ approvalId: 'approval-1', voiceTurnId: 'voice-2', transcript: 'no do not send that' })).toMatchObject({
      decision: 'denied',
      confidence: 0.95
    });
    expect(classifyApprovalVoiceDecision({ approvalId: 'approval-1', voiceTurnId: 'voice-3', transcript: 'cancel that request' })).toMatchObject({
      decision: 'cancelled',
      confidence: 0.95
    });
  });

  it('marks ambiguous approval speech as unclear', () => {
    expect(classifyApprovalVoiceDecision({ approvalId: 'approval-1', voiceTurnId: 'voice-1', transcript: 'maybe later' })).toMatchObject({
      decision: 'unclear',
      confidence: 0.35,
      transcript: 'maybe later'
    });
  });

  it('returns chat fallback copy after two unclear attempts', () => {
    expect(createApprovalVoiceFallback({ attemptCount: 2, approvalTitle: 'Send email' })).toEqual(
      'I could not tell whether to approve Send email. Please use the approval buttons in chat.'
    );
  });
});
