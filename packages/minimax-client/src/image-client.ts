interface MinimaxImageResponse {
	data?: {
		image_base64?: string[];
	};
}

export interface GenerateImageOpts {
	apiKey: string;
	prompt: string;
	aspectRatio: string;
}

export async function generateImage(opts: GenerateImageOpts): Promise<Buffer> {
	const response = await fetch("https://api.minimax.io/v1/image_generation", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${opts.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "image-01",
			prompt: opts.prompt,
			aspect_ratio: opts.aspectRatio,
			response_format: "base64",
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`MiniMax image API error ${response.status}: ${text}`);
	}

	const json = (await response.json()) as MinimaxImageResponse;
	const base64 = json.data?.image_base64?.[0];

	if (!base64) {
		throw new Error("MiniMax image API returned no image data");
	}

	return Buffer.from(base64, "base64");
}
