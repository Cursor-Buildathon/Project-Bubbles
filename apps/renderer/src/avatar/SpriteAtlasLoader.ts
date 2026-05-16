import { Assets, Rectangle, Texture } from "pixi.js";

export interface AnimationDef {
	row: number;
	frameCount: number;
	frameDurationMs: number;
}

export interface AtlasDef {
	width: number;
	height: number;
	cellWidth: number;
	cellHeight: number;
}

export interface SheetManifest {
	atlas: AtlasDef;
	animations: Record<string, AnimationDef>;
}

export interface LoadedAtlas {
	manifest: SheetManifest;
	frames: Map<string, Texture[]>;
}

const cache = new Map<string, LoadedAtlas>();

export async function loadAtlas(baseUrl: string): Promise<LoadedAtlas> {
	const cached = cache.get(baseUrl);
	if (cached) return cached;

	const jsonUrl = baseUrl.replace(/\.png$/, ".json");
	const [manifest, baseTexture] = await Promise.all([
		fetch(jsonUrl).then<SheetManifest>((r) => r.json()),
		Assets.load<Texture>(baseUrl),
	]);

	const { cellWidth, cellHeight } = manifest.atlas;
	const frames = new Map<string, Texture[]>();

	for (const [name, def] of Object.entries(manifest.animations)) {
		const textures: Texture[] = [];
		for (let col = 0; col < def.frameCount; col++) {
			const rect = new Rectangle(
				col * cellWidth,
				def.row * cellHeight,
				cellWidth,
				cellHeight,
			);
			textures.push(new Texture({ source: baseTexture.source, frame: rect }));
		}
		frames.set(name, textures);
	}

	const loaded: LoadedAtlas = { manifest, frames };
	cache.set(baseUrl, loaded);
	return loaded;
}
