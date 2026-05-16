import { initDb } from "@bubbles/memory-core";
import { createLogger } from "@bubbles/shared-logger";
import { IPC_CHANNELS } from "@bubbles/shared-types";
import { app, globalShortcut, ipcMain } from "electron";
import { initAutoUpdate } from "./autoUpdate";
import { registerAgentHandler } from "./ipc/agentHandler";
import { registerAppHandler } from "./ipc/appHandler";
import { registerAudioHandler } from "./ipc/audioHandler";
import { loadStoredApiKey, registerDebugHandler } from "./ipc/debugHandler";
import { registerMemoryHandler } from "./ipc/memoryHandler";
import { registerPermissionRouter } from "./permissionRouter";
import { ensureProjectRoot } from "./projectRoot";
import { seedPresets } from "./seedPresets";
import { createTray } from "./tray";
import { createAvatarWindow } from "./windows/avatar";
import {
	createChatPanelWindow,
	hideChatPanel,
	toggleChatPanel,
} from "./windows/chatPanel";

const logger = createLogger("desktop-main");

app.whenReady().then(async () => {
	// Seed ~/.bubbles/agents/ on first launch
	await seedPresets();

	// Initialise database
	const db = initDb();
	logger.info({ event: "db-ready" });

	// Load stored API key from safeStorage
	loadStoredApiKey();

	// Resolve workspace root
	const projectRoot = ensureProjectRoot();
	logger.info({ event: "project-root", path: projectRoot });

	// Register IPC handlers
	registerPermissionRouter();
	registerAgentHandler(db, projectRoot);
	registerMemoryHandler(db);
	registerDebugHandler();
	registerAudioHandler();
	registerAppHandler(db, projectRoot);

	// Create windows
	createAvatarWindow();
	// Chat panel created lazily on first toggle, but pre-create for faster UX
	createChatPanelWindow();

	// Global shortcut: Ctrl+Space toggles chat
	const shortcutRegistered = globalShortcut.register(
		"CommandOrControl+Space",
		() => {
			toggleChatPanel();
		},
	);
	if (shortcutRegistered) {
		logger.info({ event: "shortcut-registered", key: "Ctrl+Space" });
	}

	// Handle renderer request to close chat panel
	ipcMain.on(IPC_CHANNELS.APP_CLOSE_CHAT, () => {
		hideChatPanel();
	});

	// Auto-update (dormant unless BUBBLES_ENABLE_AUTO_UPDATE=1)
	initAutoUpdate();

	// System tray
	createTray(
		() => {
			const { BrowserWindow } = require("electron");
			const wins: import("electron").BrowserWindow[] =
				BrowserWindow.getAllWindows();
			for (const w of wins) {
				if (w.isVisible()) {
					w.hide();
				} else {
					w.show();
					w.focus();
				}
			}
		},
		() => toggleChatPanel(),
	);

	logger.info({ event: "app-ready" });
});

app.on("will-quit", () => {
	globalShortcut.unregisterAll();
});

// On Windows/Linux, quit when all windows closed.
// Avatar and chat windows have skipTaskbar, so close comes from tray Quit.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
