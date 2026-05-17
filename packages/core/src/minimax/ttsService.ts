import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactSecrets } from '../security/redactSecrets.js';
import { createMiniMaxApiError } from './minimaxApiClient.js';

const minimaxTtsEndpoint = 'https://api.minimax.io/v1/t2a_v2';

interface ResponseLike {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

export type TtsResult =
  | { ok: true; audioId: string; audioPath: string; mimeType: string; text: string; voiceStyle: string }
  | { ok: false; muted: true }
  | { ok: false; error: string };

interface TtsServiceOptions {
  muted: boolean;
  synthesize: (
    text: string,
    voiceStyle: string
  ) => Promise<{ audioPath: string; mimeType?: string; text?: string; voiceStyle?: string }>;
}

export function createTtsService({ muted, synthesize }: TtsServiceOptions) {
  return {
    async speak(text: string, voiceStyle: string): Promise<TtsResult> {
      if (muted) {
        return { ok: false, muted: true };
      }

      try {
        const result = await synthesize(text, voiceStyle);
        return {
          ok: true,
          audioId: createAudioId(result.audioPath),
          audioPath: result.audioPath,
          mimeType: result.mimeType ?? 'audio/mpeg',
          text: result.text ?? text,
          voiceStyle: result.voiceStyle ?? voiceStyle
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

function createAudioId(audioPath: string) {
  const fileName = audioPath.split('/').filter(Boolean).at(-1) ?? 'response';
  return `tts-${fileName.replace(/\W+/g, '-')}`;
}

export interface MiniMaxTtsInput {
  artifactDir: string;
  model?: string;
  text: string;
  ttsId?: string;
  voiceId?: string;
  voiceStyle?: string;
}

interface MiniMaxTtsServiceOptions {
  apiKey: string;
  fetch?: FetchLike;
}

export type MiniMaxTtsResult =
  | { ok: true; audioPath: string; audioUrl?: string; mimeType: 'audio/mpeg'; text: string; ttsId: string; voiceStyle: string }
  | { ok: false; error: string; ttsId: string };

export function createMiniMaxTtsService({
  apiKey,
  fetch: fetchImpl = globalThis.fetch as FetchLike
}: MiniMaxTtsServiceOptions) {
  return {
    async speak(input: MiniMaxTtsInput): Promise<MiniMaxTtsResult> {
      const ttsId = sanitizeTtsId(input.ttsId ?? `tts-${Date.now()}`);
      const text = input.text.trim();

      if (!text) {
        return { ok: false, error: 'Speech text is empty.', ttsId };
      }

      await mkdir(input.artifactDir, { recursive: true });

      try {
        const response = await fetchImpl(minimaxTtsEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: input.model ?? 'speech-2.8-hd',
            text,
            stream: false,
            language_boost: 'English',
            output_format: 'hex',
            voice_setting: {
              voice_id: input.voiceId ?? 'English_expressive_narrator',
              speed: speedForVoiceStyle(input.voiceStyle),
              vol: 1,
              pitch: 0
            },
            audio_setting: {
              sample_rate: 32000,
              bitrate: 128000,
              format: 'mp3',
              channel: 1
            }
          })
        });

        if (!response.ok) {
          const body = response.text ? await response.text() : '';
          throw createMiniMaxApiError(response.status, body, 'MiniMax TTS failed');
        }

        const body = responseToRecord(await response.json());
        const baseRespError = getBaseRespError(body);

        if (baseRespError) {
          throw new Error(baseRespError);
        }

        const audioHex = findString(body, ['data.audio', 'audio', 'data.audio_hex', 'audio_hex']);
        const audioBase64 = findString(body, ['data.audio_file', 'audio_file', 'data.audio_base64', 'audio_base64']);

        if (!audioHex && !audioBase64) {
          throw new Error('MiniMax TTS returned no audio data.');
        }

        const audioPath = join(input.artifactDir, `${ttsId}.mp3`);
        await writeFile(audioPath, decodeAudioPayload({ audioBase64, audioHex }));

        return {
          ok: true,
          audioPath,
          mimeType: 'audio/mpeg',
          text,
          ttsId,
          voiceStyle: input.voiceStyle ?? 'warm'
        };
      } catch (error) {
        return {
          ok: false,
          error: redactSecrets(error),
          ttsId
        };
      }
    }
  };
}

function speedForVoiceStyle(voiceStyle: string | undefined) {
  if (voiceStyle === 'brief' || voiceStyle === 'focused') {
    return 1.05;
  }

  if (voiceStyle === 'calm' || voiceStyle === 'encouraging') {
    return 0.95;
  }

  return 1;
}

function sanitizeTtsId(ttsId: string) {
  return ttsId.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'tts-current';
}

function responseToRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function findString(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, record);

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function getBaseRespError(record: Record<string, unknown>) {
  const baseResp = record.base_resp;

  if (!baseResp || typeof baseResp !== 'object') {
    return undefined;
  }

  const fields = baseResp as Record<string, unknown>;
  const statusCode = fields.status_code;
  const statusMsg = typeof fields.status_msg === 'string' ? fields.status_msg.trim() : '';
  const isSuccess = statusCode === 0 || statusCode === '0';

  if (isSuccess) {
    return undefined;
  }

  const compactCode = statusCode === undefined ? 'unknown' : String(statusCode);
  return `MiniMax TTS failed (${compactCode}): ${statusMsg || 'request was rejected without audio data'}`;
}

function decodeAudioPayload({
  audioBase64,
  audioHex
}: {
  audioBase64?: string;
  audioHex?: string;
}) {
  if (audioHex) {
    return Buffer.from(audioHex.replace(/\s+/g, ''), 'hex');
  }

  return Buffer.from((audioBase64 ?? '').replace(/\s+/g, ''), 'base64');
}
