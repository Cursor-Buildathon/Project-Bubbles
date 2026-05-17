import { describe, expect, it, vi } from 'vitest';
import { createVoiceIpcController } from './voiceIpc.js';

describe('createVoiceIpcController', () => {
  it('starts a voice session and broadcasts a session event', () => {
    const publish = vi.fn();
    const controller = createVoiceIpcController({ enabled: true, publish });

    const result = controller.startSession();

    expect(result.state.status).toBe('listening');
    expect(result.event).toMatchObject({
      type: 'voice.session_started',
      voiceTurnId: result.state.activeTurnId
    });
    expect(publish).toHaveBeenCalledWith(result.event, result.state);
  });

  it('submits a fixture transcript with affect metadata', () => {
    const publish = vi.fn();
    const controller = createVoiceIpcController({ enabled: true, publish });
    controller.startSession();

    const result = controller.submitTranscript({
      text: 'This is urgent, help me before the meeting starts.',
      confidence: 0.93,
      provider: 'fixture-transcript'
    });

    expect(result.event).toMatchObject({
      type: 'voice.final',
      text: 'This is urgent, help me before the meeting starts.',
      confidence: 0.93,
      affect: {
        primary: 'urgent',
        ttsStyle: 'focused'
      }
    });
    expect(result.state).toMatchObject({
      provider: 'fixture-transcript',
      status: 'processing',
      partialText: '',
      captionText: 'This is urgent, help me before the meeting starts.'
    });
  });

  it('streams a fixture partial transcript before the final turn', () => {
    const publish = vi.fn();
    const controller = createVoiceIpcController({ enabled: true, publish });
    const started = controller.startSession();

    const partial = controller.submitPartialTranscript({
      text: 'help me plan',
      confidence: 0.72,
      provider: 'fixture-transcript'
    });

    expect(partial.event).toEqual({
      type: 'voice.partial',
      voiceTurnId: started.state.activeTurnId,
      text: 'help me plan',
      confidence: 0.72
    });
    expect(partial.state).toMatchObject({
      provider: 'fixture-transcript',
      status: 'listening',
      partialText: 'help me plan',
      captionText: 'help me plan'
    });
  });

  it('returns a disabled provider error when voice is feature-flagged off', () => {
    const controller = createVoiceIpcController({ enabled: false, publish: vi.fn() });

    expect(controller.startSession()).toMatchObject({
      state: {
        enabled: false,
        status: 'error',
        lastError: 'Voice is disabled.'
      },
      event: {
        type: 'voice.error',
        error: 'Voice is disabled.',
        provider: 'gemini'
      }
    });
  });

  it('records barge-in and clears the active TTS caption', () => {
    const publish = vi.fn();
    const stopSpeaking = vi.fn(() => ({ ok: true, ttsId: 'tts-1' }));
    const controller = createVoiceIpcController({ enabled: true, publish, stopSpeaking });
    const started = controller.startSession();

    const result = controller.bargeIn({ stoppedTtsId: 'tts-1' });

    expect(result.event).toEqual({
      type: 'voice.barge_in',
      voiceTurnId: started.state.activeTurnId,
      stoppedTtsId: 'tts-1'
    });
    expect(result.state).toMatchObject({
      status: 'listening',
      captionText: ''
    });
    expect(stopSpeaking).toHaveBeenCalledWith({ ttsId: 'tts-1' });
  });

  it('delegates spoken playback to the MiniMax speech adapter', async () => {
    const speakText = vi.fn().mockResolvedValue({ ok: true, ttsId: 'tts-1', audioUrl: 'bubbles-artifact://local/voice.mp3' });
    const controller = createVoiceIpcController({ enabled: true, publish: vi.fn(), speakText });

    await expect(controller.speak({ text: 'Short reply.', ttsId: 'tts-1' })).resolves.toEqual({
      audioUrl: 'bubbles-artifact://local/voice.mp3',
      ok: true,
      ttsId: 'tts-1'
    });
    expect(speakText).toHaveBeenCalledWith({ text: 'Short reply.', ttsId: 'tts-1' });
  });

  it('transcribes recorded audio and emits a final voice event', async () => {
    const publish = vi.fn();
    const transcribeAudio = vi.fn().mockResolvedValue({
      ok: true,
      provider: 'gemini',
      transcript: 'Help me plan the day.'
    });
    const controller = createVoiceIpcController({ enabled: true, publish, transcribeAudio });
    const started = controller.startSession();

    const result = await controller.transcribeAudio({
      audioDataUrl: 'data:audio/wav;base64,d2F2',
      mimeType: 'audio/wav',
      voiceTurnId: started.state.activeTurnId
    });

    expect(result).toMatchObject({
      ok: true,
      provider: 'gemini',
      transcript: 'Help me plan the day.',
      event: {
        type: 'voice.final',
        text: 'Help me plan the day.'
      }
    });
    expect(result.state).toMatchObject({
      captionText: 'Help me plan the day.',
      status: 'processing'
    });
  });

  it('preserves terminal transcription failure metadata', async () => {
    const publish = vi.fn();
    const transcribeAudio = vi.fn().mockResolvedValue({
      ok: false,
      provider: 'gemini',
      error: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.',
      reason: 'quota',
      retryable: false
    });
    const controller = createVoiceIpcController({ enabled: true, publish, transcribeAudio });
    const started = controller.startSession();

    const result = await controller.transcribeAudio({
      audioDataUrl: 'data:audio/wav;base64,d2F2',
      mimeType: 'audio/wav',
      voiceTurnId: started.state.activeTurnId
    });

    expect(result).toMatchObject({
      ok: false,
      provider: 'gemini',
      reason: 'quota',
      retryable: false,
      event: {
        type: 'voice.error',
        error: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.'
      },
      state: {
        status: 'error',
        lastError: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.',
        captionText: 'Voice STT is unavailable. Gemini quota is exhausted and no working OpenAI fallback is configured.'
      }
    });
  });
});
