import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@bubbles/shared-logger";
import { app, dialog, Menu, nativeImage, Tray } from "electron";

const log = createLogger("tray");
const __dirname = resolve(fileURLToPath(import.meta.url), "..");

let tray: Tray | null = null;

function getIconPath(): string {
	if (app.isPackaged) {
		return join(process.resourcesPath, "assets", "tray", "tray.png");
	}
	return join(__dirname, "../../../../assets/tray/tray.png");
}

export function createTray(
	onShowHide: () => void,
	onOpenChat: () => void,
): Tray {
	const icon = nativeImage.createFromPath(getIconPath());
	const resized = icon.resize({ width: 16, height: 16 });
	tray = new Tray(resized);

	const menu = Menu.buildFromTemplate([
		{ label: "Show / Hide Bubbles", click: onShowHide },
		{ label: "Open Chat", click: onOpenChat },
		{ type: "separator" },
		{
			label: "Keyboard Shortcuts",
			click: () => {
				dialog.showMessageBox({
					type: "info",
					title: "Bubbles Shortcuts",
					message: "Keyboard Shortcuts",
					detail:
						"Ctrl+Space = Toggle Chat\n" +
						"Esc = Close Chat\n" +
						"Drag avatar to move\n" +
						"Click avatar to toggle chat",
					buttons: ["OK"],
				});
			},
		},
		{ type: "separator" },
		{ label: "Quit", click: () => app.quit() },
	]);

	tray.setToolTip("Bubbles");
	tray.setContextMenu(menu);
	tray.on("click", onShowHide);

	log.info({ event: "tray-created" });
	return tray;
}

export function destroyTray(): void {
	tray?.destroy();
	tray = null;
}
