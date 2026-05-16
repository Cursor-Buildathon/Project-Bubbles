import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@bubbles/shared-logger";
import { app, BrowserWindow } from "electron";
import { registerImageGenHandlers } from "./ipc/image-gen.handler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const logger = createLogger("desktop-main");

function preloadScriptPath(): string {
	const mjs = join(__dirname, "../preload/index.mjs");
	const js = join(__dirname, "../preload/index.js");
	if (existsSync(mjs)) {
		return mjs;
	}
	return js;
}

function createWindow(): void {
	const mainWindow = new BrowserWindow({
		width: 900,
		height: 640,
		show: true,
		autoHideMenuBar: true,
		webPreferences: {
			preload: preloadScriptPath(),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	const devUrl =
		process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL;
	if (devUrl) {
		void mainWindow.loadURL(devUrl);
	} else {
		void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}

	logger.info("window-created");
}

app.whenReady().then(() => {
	registerImageGenHandlers();
	createWindow();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
