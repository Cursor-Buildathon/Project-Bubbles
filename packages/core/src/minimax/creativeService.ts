import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactSecrets } from '../security/redactSecrets.js';
import { type ArtifactMetadata } from '../shared/types.js';
import { createMiniMaxApiError } from './minimaxApiClient.js';

const minimaxImageEndpoint = 'https://api.minimax.io/v1/image_generation';
const minimaxMusicEndpoint = 'https://api.minimax.io/v1/music_generation';

interface ResponseLike {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

export type CreativeKind = 'voice' | 'image' | 'vision' | 'music';

export interface CreativeRequest {
  kind: CreativeKind;
  prompt: string;
}

export type CreativeResult =
  | { ok: true; text: string; artifact?: ArtifactMetadata; artifactPath?: string }
  | { ok: false; error: string };

interface CreativeServiceOptions {
  runCreativeTask: (request: CreativeRequest) => Promise<CreativeResult>;
}

export function createCreativeService({ runCreativeTask }: CreativeServiceOptions) {
  return {
    run(request: CreativeRequest) {
      return runCreativeTask(request);
    }
  };
}

export interface MiniMaxCreativeRequest {
  artifactDir: string;
  fixture?: boolean;
  kind: 'image' | 'music';
  prompt: string;
}

interface MiniMaxCreativeServiceOptions {
  apiKey: string;
  fetch?: FetchLike;
}

export function createMiniMaxCreativeService({
  apiKey,
  fetch: fetchImpl = globalThis.fetch as FetchLike
}: MiniMaxCreativeServiceOptions) {
  return {
    async run(request: MiniMaxCreativeRequest): Promise<CreativeResult> {
      await mkdir(request.artifactDir, { recursive: true });

      if (request.fixture) {
        return writeFixtureArtifact(request);
      }

      try {
        if (request.kind === 'image') {
          return generateImage({ apiKey, fetchImpl, request });
        }

        return generateMusic({ apiKey, fetchImpl, request });
      } catch (error) {
        return {
          ok: false,
          error: redactSecrets(error)
        };
      }
    }
  };
}

async function generateImage({
  apiKey,
  fetchImpl,
  request
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  request: MiniMaxCreativeRequest;
}): Promise<CreativeResult> {
  const response = await fetchImpl(minimaxImageEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt: request.prompt,
      response_format: 'base64'
    })
  });

  if (!response.ok) {
    const body = response.text ? await response.text() : '';
    throw createMiniMaxApiError(response.status, body, 'MiniMax image generation failed');
  }

  const body = responseToRecord(await response.json());
  const imageBase64 = findString(body, ['data.image_base64', 'data.image', 'image_base64', 'image']);

  if (!imageBase64) {
    throw new Error('MiniMax image generation returned no image data.');
  }

  const artifact = artifactFor(request, false);

  if (!artifact.path) {
    return { ok: false, error: 'Artifact path could not be resolved.' };
  }

  await writeFile(artifact.path, Buffer.from(imageBase64, 'base64'));

  return {
    ok: true,
    artifact,
    artifactPath: artifact.path,
    text: 'The image is ready.'
  };
}

async function generateMusic({
  apiKey,
  fetchImpl,
  request
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  request: MiniMaxCreativeRequest;
}): Promise<CreativeResult> {
  const response = await fetchImpl(minimaxMusicEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'music-2.6',
      prompt: request.prompt,
      instrumental: true
    })
  });

  if (!response.ok) {
    const body = response.text ? await response.text() : '';
    throw createMiniMaxApiError(response.status, body, 'MiniMax music generation failed');
  }

  const body = responseToRecord(await response.json());
  const audioHex = findString(body, ['data.audio', 'audio', 'data.audio_hex', 'audio_hex']);

  if (!audioHex) {
    throw new Error('MiniMax music generation returned no audio data.');
  }

  const artifact = artifactFor(request, false);

  if (!artifact.path) {
    return { ok: false, error: 'Artifact path could not be resolved.' };
  }

  await writeFile(artifact.path, Buffer.from(audioHex, 'hex'));

  return {
    ok: true,
    artifact,
    artifactPath: artifact.path,
    text: 'The music is ready.'
  };
}

async function writeFixtureArtifact(request: MiniMaxCreativeRequest): Promise<CreativeResult> {
  const artifact = artifactFor(request, true);

  if (!artifact.path) {
    return { ok: false, error: 'Artifact path could not be resolved.' };
  }

  if (request.kind === 'image') {
    await writeFile(artifact.path, fixtureSvg(request.prompt), 'utf8');
  } else {
    await writeFile(artifact.path, fixtureAudioBytes());
  }

  return {
    ok: true,
    artifact,
    artifactPath: artifact.path,
    text: request.kind === 'image' ? 'The image is ready.' : 'The music is ready.'
  };
}

function artifactFor(request: MiniMaxCreativeRequest, fixture: boolean): ArtifactMetadata {
  const id = `${request.kind}-${Date.now()}`;

  if (request.kind === 'image') {
    return {
      id,
      kind: 'image',
      path: join(request.artifactDir, fixture ? 'image.svg' : 'image.png'),
      title: request.prompt
    };
  }

  return {
    id,
    kind: 'audio',
    path: join(request.artifactDir, fixture ? 'music.wav' : 'music.mp3'),
    title: request.prompt
  };
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

function fixtureSvg(prompt: string) {
  const escapedPrompt = prompt.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" role="img" aria-label="${escapedPrompt}">
  <rect width="960" height="540" fill="#102026"/>
  <circle cx="230" cy="170" r="92" fill="#2ec4b6"/>
  <rect x="360" y="130" width="390" height="250" rx="22" fill="#f6f3df"/>
  <text x="80" y="455" fill="#f6f3df" font-family="Inter, Arial, sans-serif" font-size="42">${escapedPrompt}</text>
</svg>
`;
}

function fixtureAudioBytes() {
  const sampleRate = 8000;
  const durationSeconds = 0.25;
  const samples = sampleRate * durationSeconds;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples; index += 1) {
    const value = Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 12000);
    buffer.writeInt16LE(value, 44 + index * 2);
  }

  return buffer;
}
