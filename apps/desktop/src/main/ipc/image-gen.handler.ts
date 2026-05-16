import { readFileSync } from "node:fs";
import { join } from "node:path";
import { app, ipcMain } from "electron";
import { ImageGenRequestSchema } from "@bubbles/shared-types";
import { runImagePipeline } from "../services/image-pipeline.js";
import { loadHistory, toggleFavorite } from "../services/prompt-history.js";

export function registerImageGenHandlers(): void {
	const historyPath = join(app.getPath("userData"), "image-history.json");
	const outDir = join(app.getPath("userData"), "generated-images");

	ipcMain.handle("v1:image:generate", async (_event, raw: unknown) => {
		const req = ImageGenRequestSchema.parse(raw);

		// Phase 2 will read from safeStorage.
		// For now read from environment variable.
		const tokenPlanKey = process.env.MINIMAX_TOKEN_PLAN_KEY ?? "";

		if (!tokenPlanKey) {
			throw new Error("MINIMAX_TOKEN_PLAN_KEY environment variable must be set");
		}

		const { entry, imageDataUrl } = await runImagePipeline({
			userPrompt: req.userPrompt,
			style: req.style,
			aspectRatio: req.aspectRatio,
			tokenPlanKey,
			historyPath,
			outDir,
		});

		return { ...entry, imageDataUrl };
	});

	ipcMain.handle("v1:image:history", () => loadHistory(historyPath));

	ipcMain.handle(
		"v1:image:toggle-favorite",
		(_event, id: string) => toggleFavorite(historyPath, id),
	);

	ipcMain.handle("v1:image:load-data", (_event, imagePath: string) => {
		const buf = readFileSync(imagePath);
		return `data:image/jpeg;base64,${buf.toString("base64")}`;
	});
}
