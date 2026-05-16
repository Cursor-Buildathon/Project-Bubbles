import { createLogger } from "@bubbles/shared-logger";
import { app } from "electron";

const log = createLogger("auto-update");

/**
 * Auto-update scaffold — dormant unless BUBBLES_ENABLE_AUTO_UPDATE=1.
 * Phase 6: placeholder only. V1 will wire electron-updater here.
 */
export function initAutoUpdate(): void {
	if (process.env.BUBBLES_ENABLE_AUTO_UPDATE !== "1") {
		log.info({ event: "auto-update-skipped", reason: "env-not-set" });
		return;
	}

	if (!app.isPackaged) {
		log.info({ event: "auto-update-skipped", reason: "dev-mode" });
		return;
	}

	log.info({ event: "auto-update-init" });
	// V1: import { autoUpdater } from "electron-updater";
	// autoUpdater.checkForUpdatesAndNotify();
}
