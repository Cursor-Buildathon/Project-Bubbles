/**
 * Style-keyword map for the MiniMax image-01 model.
 * Maps each style preset to a set of quality and style-specific keywords
 * that improve generation quality without requiring an LLM call.
 */
const STYLE_KEYWORDS: Record<string, string> = {
	photorealistic:
		"photorealistic, 8k uhd, dslr photo, high quality, sharp focus, detailed, realistic lighting, film grain",
	anime:
		"anime style, manga, vibrant colors, detailed line art, cel shading, studio ghibli aesthetic",
	"oil-painting":
		"oil painting on canvas, expressive brush strokes, impasto technique, classical painting, rich textured surface",
	"pixel-art":
		"pixel art, 8-bit retro, crisp pixels, sprite art, clean pixel grid, limited color palette, retro game aesthetic",
	watercolor:
		"watercolor painting, soft edges, transparent washes, wet-on-wet, paper texture, artistic",
	"3d-render":
		"3d render, octane render, ray tracing, subsurface scattering, global illumination, photorealistic CGI, blender",
	"comic-book":
		"comic book style, bold black outlines, halftone dots, vibrant flat colors, action lines, ink drawing",
	"line-art":
		"line art, clean crisp linework, minimal shading, fine details, black and white, technical illustration",
	fantasy:
		"fantasy digital art, magical atmosphere, ethereal glow, mystical, high detail, concept art, artstation trending",
	none: "",
};

const QUALITY_SUFFIX =
	"masterpiece, best quality, highly detailed, professional";

export interface EnhanceOpts {
	userPrompt: string;
	style: string;
}

/**
 * Builds an enhanced prompt for the image-01 model by appending
 * style-specific keywords. Synchronous — no API call required.
 */
export function enhanceImagePrompt(opts: EnhanceOpts): string {
	const { userPrompt, style } = opts;
	const styleKeywords = STYLE_KEYWORDS[style] ?? "";

	const parts = [userPrompt];
	if (styleKeywords) parts.push(styleKeywords);
	parts.push(QUALITY_SUFFIX);

	return parts.join(", ");
}
