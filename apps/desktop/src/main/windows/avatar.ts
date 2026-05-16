import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@bubbles/shared-logger";
import { app, BrowserWindow, screen } from "electron";
import { getAvatarBounds, setAvatarBounds } from "../store";
import { AVATAR_WINDOW_SIZE, resolveVisibleBounds } from "./bounds";

const log = createLogger("avatar-window");
const __dirname = resolve(fileURLToPath(import.meta.url), "..");

let avatarWindow: BrowserWindow | null = null;

function preloadScriptPath(): string {
	const mjs = join(__dirname, "../preload/index.mjs");
	const js = join(__dirname, "../preload/index.js");
	const { existsSync } = require("node:fs");
	return existsSync(mjs) ? mjs : js;
}

export function createAvatarWindow(): BrowserWindow {
	const saved = getAvatarBounds();
	const primaryWorkArea = screen.getPrimaryDisplay().workArea;
	const allWorkAreas = screen
		.getAllDisplays()
		.map((display) => display.workArea);
	const bounds = resolveVisibleBounds(saved, primaryWorkArea, allWorkAreas);

	avatarWindow = new BrowserWindow({
		x: bounds.x,
		y: bounds.y,
		width: AVATAR_WINDOW_SIZE.width,
		height: AVATAR_WINDOW_SIZE.height,
		minWidth: AVATAR_WINDOW_SIZE.width,
		minHeight: AVATAR_WINDOW_SIZE.height,
		maxWidth: AVATAR_WINDOW_SIZE.width,
		maxHeight: AVATAR_WINDOW_SIZE.height,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		resizable: false,
		skipTaskbar: true,
		hasShadow: false,
		show: true,
		webPreferences: {
			preload: preloadScriptPath(),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	// NOTE: We deliberately do NOT use setIgnoreMouseEvents here. With a frameless
	// transparent window on Windows, `{ forward: true }` does not reliably forward
	// mousemove events to the renderer, which breaks the hover-to-toggle approach.
	// The avatar window is always interactive — the transparent area around the
	// sprite simply doesn't accept clicks because there's nothing to click.

	const devUrl =
		process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL;
	if (devUrl) {
		void avatarWindow.loadURL(`${devUrl}?window=avatar`);
	} else {
		void avatarWindow.loadFile(join(__dirname, "../renderer/index.html"), {
			query: { window: "avatar" },
		});
	}

	if (!app.isPackaged) {
		avatarWindow.webContents.openDevTools({ mode: "detach" });
	}

	avatarWindow.on("moved", () => {
		if (!avatarWindow) return;
		const [wx, wy] = avatarWindow.getPosition();
		const [ww, wh] = avatarWindow.getSize();
		setAvatarBounds({ x: wx, y: wy, width: ww, height: wh });

		// Reposition chat panel if visible
		const { getChatPanelWindow, positionChatPanel } = require("./chatPanel");
		const panel = getChatPanelWindow();
		if (panel && !panel.isDestroyed() && panel.isVisible()) {
			positionChatPanel();
		}
	});

	avatarWindow.on("closed", () => {
		avatarWindow = null;
	});

	log.info({ event: "avatar-window-created", x: bounds.x, y: bounds.y });
	return avatarWindow;
}

export function getAvatarWindow(): BrowserWindow | null {
	return avatarWindow;
}
