import { describe, expect, it } from 'vitest';
import { createInitialVoiceSessionState, type VoiceEvent, type VoiceTurnContext } from './voiceTypes.js';

describe('voiceTypes', () => {
  it('creates a disabled push-to-talk macOS voice state by default', () => {
    expect(createInitialVoiceSessionState()).toEqual({
      enabled: false,
      mode: 'push-to-talk',
      provider: 'native-macos',
      status: 'idle',
      activeTurnId: undefined,
      partialText: '',
      captionText: '',
      lastError: undefined
    });
  });

  it('keeps the public VoiceEvent and VoiceTurnContext contracts usable together', () => {
    const context: VoiceTurnContext = {
      voiceTurnId: 'voice-1',
      traceId: 'trace-1',
      inputMode: 'voice',
      sttProvider: 'native-macos',
      spokenSummaryPreferred: true,
      locale: 'en-US',
      timezone: 'America/Los_Angeles'
    };
    const event: VoiceEvent = {
      type: 'voice.final',
      voiceTurnId: context.voiceTurnId,
      text: 'Help me plan my day.',
      confidence: 0.92
    };

    expect(event.voiceTurnId).toBe(context.voiceTurnId);
    expect(context.spokenSummaryPreferred).toBe(true);
  });
});
