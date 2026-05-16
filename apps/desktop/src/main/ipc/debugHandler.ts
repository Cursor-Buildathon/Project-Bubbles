import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getApiKey, setApiKey } from "@bubbles/minimax-client";
import { createLogger } from "@bubbles/shared-logger";
import {
	DebugSetApiKeyRequestSchema,
	IPC_CHANNELS,
} from "@bubbles/shared-types";
import { app, ipcMain, safeStorage } from "electron";
import { getProjectRoot } from "../store";

const log = createLogger("debug-handler");

// Lazy — app.getPath() must be called after app.whenReady().
function keyFile(): string {
	return join(app.getPath("userData"), "api-key.enc");
}

/** Load the stored key from disk (if safeStorage is available) and call setApiKey. */
export function loadStoredApiKey(): void {
	const file = keyFile();
	if (!existsSync(file)) return;
	try {
		if (safeStorage.isEncryptionAvailable()) {
			const encrypted = readFileSync(file);
			const key = safeStorage.decryptString(encrypted);
			setApiKey(key);
			log.info({ event: "api-key-loaded" });
		}
	} catch (err) {
		log.warn({ event: "api-key-load-failed", error: String(err) });
	}
}

export function registerDebugHandler(): void {
	ipcMain.handle(IPC_CHANNELS.DEBUG_HAS_API_KEY, async () => {
		try {
			getApiKey();
			return { hasKey: true };
		} catch {
			return { hasKey: false };
		}
	});

	ipcMain.handle(IPC_CHANNELS.DEBUG_SET_API_KEY, async (_evt, raw: unknown) => {
		const parseResult = DebugSetApiKeyRequestSchema.safeParse(raw);
		if (!parseResult.success) {
			return { ok: false };
		}

		const { key } = parseResult.data;

		// Always set the in-memory key first — this is what makes chat work.
		// Persistence is best-effort; failures here shouldn't block the user.
		setApiKey(key);
		log.info({ event: "api-key-set" });

		try {
			if (safeStorage.isEncryptionAvailable()) {
				const encrypted = safeStorage.encryptString(key);
				writeFileSync(keyFile(), encrypted);
				log.info({ event: "api-key-persisted" });
			} else {
				log.warn({ event: "safe-storage-unavailable" });
			}
		} catch (err) {
			log.warn({ event: "api-key-persist-failed", error: String(err) });
		}

		return { ok: true };
	});

	ipcMain.handle(IPC_CHANNELS.DEBUG_NEEDS_ONBOARDING, async () => {
		try {
			getApiKey();
		} catch {
			return { needsOnboarding: true, reason: "no_api_key" };
		}
		const root = getProjectRoot();
		if (!root) {
			return { needsOnboarding: true, reason: "no_project_root" };
		}
		return { needsOnboarding: false };
	});
}
