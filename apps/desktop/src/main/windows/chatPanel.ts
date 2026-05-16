import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@bubbles/shared-logger";
import { BrowserWindow } from "electron";
import { getAppIconPath } from "../icon";
import { getAvatarBounds, setChatPanelOpen } from "../store";

const log = createLogger("chat-panel");
const __dirname = resolve(fileURLToPath(import.meta.url), "..");

let chatPanel: BrowserWindow | null = null;

function preloadScriptPath(): string {
	const mjs = join(__dirname, "../preload/index.mjs");
	const js = join(__dirname, "../preload/index.js");
	return existsSync(mjs) ? mjs : js;
}

export function createChatPanelWindow(): BrowserWindow {
	chatPanel = new BrowserWindow({
		width: 900,
		height: 640,
		show: false,
		autoHideMenuBar: true,
		icon: getAppIconPath(),
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
		void chatPanel.loadURL(`${devUrl}?window=chat`);
	} else {
		void chatPanel.loadFile(join(__dirname, "../renderer/index.html"), {
			query: { window: "chat" },
		});
	}

	chatPanel.on("closed", () => {
		setChatPanelOpen(false);
		chatPanel = null;
	});

	chatPanel.on("hide", () => {
		setChatPanelOpen(false);
	});

	chatPanel.on("show", () => {
		setChatPanelOpen(true);
	});

	chatPanel.webContents.on("before-input-event", (event, input) => {
		if (input.key === "Escape" && input.type === "keyDown") {
			event.preventDefault();
			hideChatPanel();
		}
	});

	log.info({ event: "chat-panel-created" });
	return chatPanel;
}

export function getChatPanelWindow(): BrowserWindow | null {
	return chatPanel;
}

export function positionChatPanel(): void {
	if (!chatPanel) return;
	const avatarBounds = getAvatarBounds();
	const { screen } = require("electron");
	const primary = screen.getPrimaryDisplay().workArea;

	// Default: place to the right of the avatar
	let x = avatarBounds.x + avatarBounds.width + 12;
	let y = avatarBounds.y;

	// If it would go off the right edge, place to the left
	if (x + 900 > primary.x + primary.width) {
		x = avatarBounds.x - 900 - 12;
	}

	// Ensure y stays within the work area
	if (y + 640 > primary.y + primary.height) {
		y = primary.y + primary.height - 640 - 12;
	}
	if (y < primary.y) {
		y = primary.y + 12;
	}

	chatPanel.setPosition(Math.round(x), Math.round(y));
}

export function hideChatPanel(): void {
	if (!chatPanel || chatPanel.isDestroyed()) return;
	chatPanel.hide();
}

export function toggleChatPanel(): void {
	if (!chatPanel) {
		const panel = createChatPanelWindow();
		positionChatPanel();
		panel.show();
		panel.focus();
		return;
	}
	if (chatPanel.isVisible()) {
		hideChatPanel();
	} else {
		positionChatPanel();
		chatPanel.show();
		chatPanel.focus();
	}
}
