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
