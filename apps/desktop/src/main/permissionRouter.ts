import type { UserDecision } from "@bubbles/permission-guard";
import { createLogger } from "@bubbles/shared-logger";
import {
	IPC_CHANNELS,
	type PermissionRequest,
	type PermissionResponse,
	PermissionResponseSchema,
} from "@bubbles/shared-types";
import type { WebContents } from "electron";
import { ipcMain } from "electron";

const log = createLogger("permission-router");

type Resolver = (decision: UserDecision) => void;
const pending = new Map<string, Resolver>();

/** Register the IPC handler for permission responses (call once at startup). */
export function registerPermissionRouter(): void {
	ipcMain.on(IPC_CHANNELS.PERMISSION_RESPOND, (_evt, raw: unknown) => {
		const result = PermissionResponseSchema.safeParse(raw);
		if (!result.success) {
			log.warn({ event: "invalid-permission-response" });
			return;
		}
		const { requestId, decision } = result.data as PermissionResponse;
		const resolve = pending.get(requestId);
		if (resolve) {
			pending.delete(requestId);
			resolve(decision as UserDecision);
		}
	});
}

/**
 * Send a permission request to the renderer and wait for the user's decision.
 * The returned promise resolves once the renderer calls permission.respond().
 */
export function requestPermissionFromRenderer(
	sender: WebContents,
	req: PermissionRequest,
): Promise<UserDecision> {
	return new Promise<UserDecision>((resolve) => {
		pending.set(req.requestId, resolve);
		sender.send(IPC_CHANNELS.PERMISSION_REQUEST, req);
		log.info({
			event: "permission-requested",
			tool: req.tool,
			requestId: req.requestId,
		});
	});
}
