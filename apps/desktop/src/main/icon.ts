import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

export function getAppIconPath(): string {
	if (app.isPackaged) {
		return join(process.resourcesPath, "assets", "tray", "tray.png");
	}
	return join(__dirname, "../../../../assets/tray/tray.png");
}
