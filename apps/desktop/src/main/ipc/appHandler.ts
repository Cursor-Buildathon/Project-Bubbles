import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Db } from "@bubbles/memory-core";
import { getDailySummary } from "@bubbles/memory-core";
import { createLogger } from "@bubbles/shared-logger";
import {
	FilePeekRequestSchema,
	IPC_CHANNELS,
	PickFolderResponseSchema,
	SetCostCapRequestSchema,
	SpendSummaryRequestSchema,
} from "@bubbles/shared-types";
import { dialog, ipcMain } from "electron";
import { getCostCapUsd, setCostCapUsd } from "../store";

const log = createLogger("app-handler");

function resolveScopedPath(projectRoot: string, userPath: string): string {
	const resolved = resolve(projectRoot, userPath);
	const scoped = relative(resolve(projectRoot), resolved);
	if (scoped.startsWith("..") || isAbsolute(scoped)) {
		throw new Error("Path escapes project root");
	}
	return resolved;
}

export function registerAppHandler(db: Db, projectRoot: string): void {
	ipcMain.handle(IPC_CHANNELS.APP_PICK_FOLDER, async () => {
		const result = await dialog.showOpenDialog({
			properties: ["openDirectory"],
			defaultPath: projectRoot,
		});
		return PickFolderResponseSchema.parse({
			canceled: result.canceled,
			filePaths: result.filePaths,
		});
	});

	ipcMain.handle(IPC_CHANNELS.FILE_PEEK, async (_evt, raw: unknown) => {
		const parseResult = FilePeekRequestSchema.safeParse(raw);
		if (!parseResult.success) {
			return { exists: false, content: "" };
		}
		const { path: filePath } = parseResult.data;
		try {
			const fullPath = resolveScopedPath(projectRoot, filePath);
			if (!existsSync(fullPath)) {
				return { exists: false, content: "" };
			}
			const content = readFileSync(fullPath, "utf-8");
			return { exists: true, content: content.slice(0, 2000) };
		} catch (err) {
			log.warn({ event: "file-peek-failed", error: String(err) });
			return { exists: false, content: "" };
		}
	});

	ipcMain.handle(
		IPC_CHANNELS.SETTINGS_GET_SPEND,
		async (_evt, raw: unknown) => {
			const parseResult = SpendSummaryRequestSchema.safeParse(raw);
			const days = parseResult.success ? parseResult.data.days : 7;
			const summary = getDailySummary(db, days);
			return {
				days: summary,
				capUsd: getCostCapUsd(),
			};
		},
	);

	ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_CAP, async (_evt, raw: unknown) => {
		const parseResult = SetCostCapRequestSchema.safeParse(raw);
		if (!parseResult.success) {
			return { ok: false };
		}
		setCostCapUsd(parseResult.data.capUsd);
		log.info({ event: "cost-cap-updated", capUsd: parseResult.data.capUsd });
		return { ok: true };
	});
}
