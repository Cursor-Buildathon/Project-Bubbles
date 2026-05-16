import type { Db } from "@bubbles/memory-core";
import { getMessagesByConversation } from "@bubbles/memory-core";
import { createLogger } from "@bubbles/shared-logger";
import { IPC_CHANNELS, MemoryQueryRequestSchema } from "@bubbles/shared-types";
import { ipcMain } from "electron";

const log = createLogger("memory-handler");

export function registerMemoryHandler(db: Db): void {
	ipcMain.handle(IPC_CHANNELS.MEMORY_QUERY, async (_evt, raw: unknown) => {
		const parseResult = MemoryQueryRequestSchema.safeParse(raw);
		if (!parseResult.success) {
			return { messages: [] };
		}

		const req = parseResult.data;
		log.info({ event: "memory-query", conversationId: req.conversationId });

		if (!req.conversationId) {
			return { messages: [] };
		}

		const rows = getMessagesByConversation(db, req.conversationId).slice(
			0,
			req.limit,
		);

		return {
			messages: rows.map((r) => ({
				id: r.id,
				role: r.role,
				content: r.content,
				createdAt: r.created_at,
			})),
		};
	});
}
