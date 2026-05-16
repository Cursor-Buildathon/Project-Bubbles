import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { redactSecrets } from '../security/redactSecrets.js';
import { type ArtifactMetadata } from '../shared/types.js';
import { type CommandRunner } from '../shared/commandRunner.js';

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
  runCommand: CommandRunner;
}

export function createMiniMaxCreativeService({ runCommand }: MiniMaxCreativeServiceOptions) {
  return {
    async run(request: MiniMaxCreativeRequest): Promise<CreativeResult> {
      await mkdir(request.artifactDir, { recursive: true });

      if (request.fixture) {
        return writeFixtureArtifact(request);
      }

      const command = 'mmx';
      const args =
        request.kind === 'image'
          ? ['image', 'generate', '--prompt', request.prompt, '--out-dir', request.artifactDir]
          : ['music', 'generate', '--prompt', request.prompt, '--out', join(request.artifactDir, 'music.mp3')];
      const result = await runCommand(command, args);

      if (result.exitCode !== 0) {
        return {
          ok: false,
          error: redactSecrets(result.stderr || result.stdout || 'MiniMax media generation failed.')
        };
      }

      const artifact = artifactFor(request, false);
      return {
        ok: true,
        artifact,
        artifactPath: artifact.path,
        text: request.kind === 'image' ? 'The image is ready.' : 'The music is ready.'
      };
    }
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
      path: join(request.artifactDir, 'image.svg'),
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
