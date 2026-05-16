import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { enhanceImagePrompt, generateImage } from "@bubbles/minimax-client";
import type { ImageGenResult } from "@bubbles/shared-types";
import { appendToHistory } from "./prompt-history.js";

export interface PipelineOpts {
	userPrompt: string;
	style: string;
	aspectRatio: string;
	tokenPlanKey: string;
	historyPath: string;
	outDir: string;
}

export interface PipelineResult {
	entry: ImageGenResult;
	imageDataUrl: string;
}

export async function runImagePipeline(
	opts: PipelineOpts,
): Promise<PipelineResult> {
	const id = randomUUID();

	const enhanced = enhanceImagePrompt({
		userPrompt: opts.userPrompt,
		style: opts.style,
	});

	const imageBuffer = await generateImage({
		apiKey: opts.tokenPlanKey,
		prompt: enhanced,
		aspectRatio: opts.aspectRatio,
	});

	await mkdir(opts.outDir, { recursive: true });
	const imagePath = join(opts.outDir, `bubbles-${id}.jpeg`);
	await writeFile(imagePath, imageBuffer);

	const entry: ImageGenResult = {
		id,
		userPrompt: opts.userPrompt,
		enhancedPrompt: enhanced,
		imagePath,
		style: opts.style,
		aspectRatio: opts.aspectRatio,
		createdAt: new Date().toISOString(),
		favorite: false,
	};

	appendToHistory(opts.historyPath, entry);

	const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

	return { entry, imageDataUrl };
}
