/**
 * Standalone pipeline test — no Electron, no IPC, no safeStorage.
 * Uses only the MiniMax Token Plan key for image generation.
 *
 * Usage (Windows PowerShell):
 *   $env:MINIMAX_TOKEN_PLAN_KEY="sk-cp-..."
 *   pnpm tsx scripts/test-image-pipeline.ts "a cute cat on a cloud" pixel-art
 *
 * Usage (macOS / Linux):
 *   MINIMAX_TOKEN_PLAN_KEY=sk-cp-... \
 *     pnpm tsx scripts/test-image-pipeline.ts "a cute cat on a cloud" pixel-art
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	enhanceImagePrompt,
	generateImage,
} from "../packages/minimax-client/src/index.js";

const userPrompt = process.argv[2];
const style = process.argv[3] ?? "none";

if (!userPrompt) {
	console.error(
		"Usage: pnpm tsx scripts/test-image-pipeline.ts <prompt> [style]",
	);
	console.error(
		"Styles: photorealistic | anime | oil-painting | pixel-art | watercolor | 3d-render | comic-book | line-art | fantasy | none",
	);
	process.exit(1);
}

const tokenPlanKey = process.env.MINIMAX_TOKEN_PLAN_KEY ?? "";

if (!tokenPlanKey) {
	console.error(
		"Error: MINIMAX_TOKEN_PLAN_KEY environment variable must be set.",
	);
	process.exit(1);
}

console.log("\n=== Image Generation Pipeline Test ===");
console.log(`Original prompt : ${userPrompt}`);
console.log(`Style           : ${style}`);

console.log("\nStep 1/2 — Building enhanced prompt...");
const enhanced = enhanceImagePrompt({ userPrompt, style });
console.log(`Enhanced prompt : ${enhanced}`);

console.log("\nStep 2/2 — Generating image via MiniMax image API...");
const imageBuffer = await generateImage({
	apiKey: tokenPlanKey,
	prompt: enhanced,
	aspectRatio: "1:1",
});
console.log(`Image size      : ${imageBuffer.length.toLocaleString()} bytes`);

const outPath = join(process.cwd(), "test-output.jpeg");
writeFileSync(outPath, imageBuffer);

console.log("\n=== Result ===");
console.log(`Saved to        : ${outPath}`);
console.log("Pipeline test complete.");
