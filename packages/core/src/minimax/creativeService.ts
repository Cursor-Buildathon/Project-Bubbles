import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactSecrets } from '../security/redactSecrets.js';
import { type ArtifactMetadata } from '../shared/types.js';
import { createMiniMaxApiError } from './minimaxApiClient.js';

const minimaxImageEndpoint = 'https://api.minimax.io/v1/image_generation';
const minimaxMusicEndpoint = 'https://api.minimax.io/v1/music_generation';
const minimaxVideoEndpoint = 'https://api.minimax.io/v1/video_generation';
const minimaxVideoQueryEndpoint = 'https://api.minimax.io/v1/query/video_generation';
const minimaxFileRetrieveEndpoint = 'https://api.minimax.io/v1/files/retrieve';
const defaultVideoPollIntervalMs = 10_000;
const defaultVideoMaxPolls = 60;

interface ResponseLike {
  arrayBuffer?: () => Promise<ArrayBuffer>;
  json?: () => Promise<unknown>;
  ok: boolean;
  status: number;
  text?: () => Promise<string>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>;

export type CreativeKind = 'voice' | 'image' | 'vision' | 'music' | 'video';

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
  kind: 'image' | 'music' | 'video';
  prompt: string;
}

interface MiniMaxCreativeServiceOptions {
  apiKey: string;
  fetch?: FetchLike;
  sleep?: (durationMs: number) => Promise<void>;
  videoMaxPolls?: number;
  videoPollIntervalMs?: number;
}

export function createMiniMaxCreativeService({
  apiKey,
  fetch: fetchImpl = globalThis.fetch as FetchLike,
  sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)),
  videoMaxPolls = defaultVideoMaxPolls,
  videoPollIntervalMs = defaultVideoPollIntervalMs
}: MiniMaxCreativeServiceOptions) {
  return {
    async run(request: MiniMaxCreativeRequest): Promise<CreativeResult> {
      await mkdir(request.artifactDir, { recursive: true });

      if (request.fixture) {
        return writeFixtureArtifact(request);
      }

      try {
        if (request.kind === 'image') {
          return await generateImage({ apiKey, fetchImpl, request });
        }

        if (request.kind === 'video') {
          return await generateVideo({
            apiKey,
            fetchImpl,
            maxPolls: videoMaxPolls,
            pollIntervalMs: videoPollIntervalMs,
            request,
            sleep
          });
        }

        return await generateMusic({ apiKey, fetchImpl, request });
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
      response_format: 'base64',
      n: 1,
      prompt_optimizer: false
    })
  });

  if (!response.ok) {
    const body = response.text ? await response.text() : '';
    throw createMiniMaxApiError(response.status, body, 'MiniMax image generation failed');
  }

  const body = responseToRecord(await parseJson(response, 'MiniMax image generation returned no response body.'));
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

  const body = responseToRecord(await parseJson(response, 'MiniMax music generation returned no response body.'));
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

async function generateVideo({
  apiKey,
  fetchImpl,
  maxPolls,
  pollIntervalMs,
  request,
  sleep
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  maxPolls: number;
  pollIntervalMs: number;
  request: MiniMaxCreativeRequest;
  sleep: (durationMs: number) => Promise<void>;
}): Promise<CreativeResult> {
  const createResponse = await fetchImpl(minimaxVideoEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'MiniMax-Hailuo-2.3',
      prompt: request.prompt,
      duration: 6,
      resolution: '768P',
      prompt_optimizer: false
    })
  });

  if (!createResponse.ok) {
    const body = createResponse.text ? await createResponse.text() : '';
    throw createMiniMaxApiError(createResponse.status, body, 'MiniMax video generation failed');
  }

  const createBody = responseToRecord(await parseJson(createResponse, 'MiniMax video generation returned no response body.'));
  assertMiniMaxBaseRespOk(createBody, 'MiniMax video generation failed');
  const taskId = findString(createBody, ['task_id', 'data.task_id']);

  if (!taskId) {
    throw new Error('MiniMax video generation returned no task id.');
  }

  const fileId = await pollVideoGeneration({
    apiKey,
    fetchImpl,
    maxPolls,
    pollIntervalMs,
    sleep,
    taskId
  });
  const downloadUrl = await retrieveVideoDownloadUrl({ apiKey, fetchImpl, fileId });
  const videoResponse = await fetchImpl(downloadUrl, {
    method: 'GET'
  });

  if (!videoResponse.ok) {
    const body = videoResponse.text ? await videoResponse.text() : '';
    throw createMiniMaxApiError(videoResponse.status, body, 'MiniMax video download failed');
  }

  if (!videoResponse.arrayBuffer) {
    throw new Error('MiniMax video download returned no video data.');
  }

  const artifact = artifactFor(request, false);

  if (!artifact.path) {
    return { ok: false, error: 'Artifact path could not be resolved.' };
  }

  await writeFile(artifact.path, Buffer.from(await videoResponse.arrayBuffer()));

  return {
    ok: true,
    artifact,
    artifactPath: artifact.path,
    text: 'The video is ready.'
  };
}

async function pollVideoGeneration({
  apiKey,
  fetchImpl,
  maxPolls,
  pollIntervalMs,
  sleep,
  taskId
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  maxPolls: number;
  pollIntervalMs: number;
  sleep: (durationMs: number) => Promise<void>;
  taskId: string;
}) {
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const queryUrl = `${minimaxVideoQueryEndpoint}?task_id=${encodeURIComponent(taskId)}`;
    const queryResponse = await fetchImpl(queryUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!queryResponse.ok) {
      const body = queryResponse.text ? await queryResponse.text() : '';
      throw createMiniMaxApiError(queryResponse.status, body, 'MiniMax video generation status check failed');
    }

    const queryBody = responseToRecord(await parseJson(queryResponse, 'MiniMax video generation status check returned no response body.'));
    assertMiniMaxBaseRespOk(queryBody, 'MiniMax video generation status check failed');
    const status = findString(queryBody, ['status', 'data.status'])?.toLowerCase();

    if (status === 'success') {
      const fileId = findString(queryBody, ['file_id', 'data.file_id', 'file.file_id']);

      if (!fileId) {
        throw new Error('MiniMax video generation finished without a file id.');
      }

      return fileId;
    }

    if (status === 'fail' || status === 'failed') {
      const reason = findString(queryBody, ['base_resp.status_msg', 'error', 'message', 'data.error']);
      throw new Error(`MiniMax video generation failed${reason ? `: ${reason}` : '.'}`);
    }

    if (attempt < maxPolls - 1) {
      await sleep(pollIntervalMs);
    }
  }

  throw new Error('MiniMax video generation timed out before the video was ready.');
}

async function retrieveVideoDownloadUrl({
  apiKey,
  fetchImpl,
  fileId
}: {
  apiKey: string;
  fetchImpl: FetchLike;
  fileId: string;
}) {
  const retrieveUrl = `${minimaxFileRetrieveEndpoint}?file_id=${encodeURIComponent(fileId)}`;
  const retrieveResponse = await fetchImpl(retrieveUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!retrieveResponse.ok) {
    const body = retrieveResponse.text ? await retrieveResponse.text() : '';
    throw createMiniMaxApiError(retrieveResponse.status, body, 'MiniMax video file retrieve failed');
  }

  const retrieveBody = responseToRecord(await parseJson(retrieveResponse, 'MiniMax video file retrieve returned no response body.'));
  assertMiniMaxBaseRespOk(retrieveBody, 'MiniMax video file retrieve failed');
  const downloadUrl = findString(retrieveBody, ['file.download_url', 'data.download_url', 'download_url']);

  if (!downloadUrl) {
    throw new Error('MiniMax video generation returned no download URL.');
  }

  return downloadUrl;
}

async function writeFixtureArtifact(request: MiniMaxCreativeRequest): Promise<CreativeResult> {
  const artifact = artifactFor(request, true);

  if (!artifact.path) {
    return { ok: false, error: 'Artifact path could not be resolved.' };
  }

  if (request.kind === 'image') {
    await writeFile(artifact.path, fixtureSvg(request.prompt), 'utf8');
  } else if (request.kind === 'video') {
    await writeFile(artifact.path, fixtureVideoBytes());
  } else {
    await writeFile(artifact.path, fixtureAudioBytes());
  }

  return {
    ok: true,
    artifact,
    artifactPath: artifact.path,
    text:
      request.kind === 'image'
        ? 'The image is ready.'
        : request.kind === 'video'
          ? 'The video is ready.'
          : 'The music is ready.'
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

  if (request.kind === 'video') {
    return {
      id,
      kind: 'video',
      path: join(request.artifactDir, 'video.mp4'),
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

async function parseJson(response: ResponseLike, missingBodyMessage: string) {
  if (!response.json) {
    throw new Error(missingBodyMessage);
  }

  return response.json();
}

function responseToRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function assertMiniMaxBaseRespOk(record: Record<string, unknown>, fallbackMessage: string) {
  const statusCode = findNumber(record, ['base_resp.status_code', 'data.base_resp.status_code']);

  if (statusCode === undefined || statusCode === 0) {
    return;
  }

  const statusMessage = findString(record, ['base_resp.status_msg', 'data.base_resp.status_msg']);
  throw new Error(`${fallbackMessage}${statusMessage ? `: ${statusMessage}` : ` (${statusCode})`}`);
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

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (Array.isArray(value)) {
      const firstString = value.find(
        (item): item is string | number =>
          (typeof item === 'string' && item.trim().length > 0) || (typeof item === 'number' && Number.isFinite(item))
      );

      if (firstString !== undefined) {
        return String(firstString);
      }
    }
  }

  return undefined;
}

function findNumber(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, record);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
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

function fixtureVideoBytes() {
  return Buffer.from('bubbles-fixture-video');
}
