import { z } from "zod";

export const STYLE_PRESETS = [
	"photorealistic",
	"anime",
	"oil-painting",
	"pixel-art",
	"watercolor",
	"3d-render",
	"comic-book",
	"line-art",
	"fantasy",
	"none",
] as const;

export const StylePresetSchema = z.enum(STYLE_PRESETS);

export const AspectRatioSchema = z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]);

export const ImageGenRequestSchema = z.object({
	userPrompt: z.string().min(1).max(1000),
	style: StylePresetSchema.default("none"),
	aspectRatio: AspectRatioSchema.default("1:1"),
});

export const ImageGenResultSchema = z.object({
	id: z.string(),
	userPrompt: z.string(),
	enhancedPrompt: z.string(),
	imagePath: z.string(),
	style: z.string(),
	aspectRatio: z.string(),
	createdAt: z.string(),
	favorite: z.boolean(),
});

export const IPC = {
	IMAGE_GENERATE: "v1:image:generate",
	IMAGE_HISTORY: "v1:image:history",
	IMAGE_TOGGLE_FAV: "v1:image:toggle-favorite",
	IMAGE_LOAD_DATA: "v1:image:load-data",
} as const;

export type StylePreset = z.infer<typeof StylePresetSchema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type ImageGenRequest = z.infer<typeof ImageGenRequestSchema>;
export type ImageGenResult = z.infer<typeof ImageGenResultSchema>;
