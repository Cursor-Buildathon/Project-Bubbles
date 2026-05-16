import { Application, TextureStyle } from "pixi.js";

let app: Application | null = null;

export async function initSpriteEngine(
	canvas: HTMLCanvasElement,
): Promise<Application> {
	if (app) return app;

	TextureStyle.defaultOptions.scaleMode = "nearest";

	app = new Application();
	await app.init({
		canvas,
		width: canvas.clientWidth || 256,
		height: canvas.clientHeight || 280,
		backgroundAlpha: 0,
		antialias: false,
		resolution: window.devicePixelRatio || 1,
		autoDensity: true,
	});

	return app;
}

export function getSpriteEngine(): Application | null {
	return app;
}

export function destroySpriteEngine(): void {
	app?.destroy(false);
	app = null;
}
