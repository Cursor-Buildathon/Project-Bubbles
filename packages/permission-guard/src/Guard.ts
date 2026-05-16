import { randomUUID } from "node:crypto";
import type { Db } from "@bubbles/memory-core";
import type { PermissionRequest } from "@bubbles/shared-types";
import type { Tool, ToolArgs, ToolContext } from "@bubbles/tool-kit";

export type Decision = "allow" | "deny";
export type UserDecision = "allow" | "deny" | "allow_always";

export interface GuardConfig {
	db?: Db;
	turnId: string;
	/**
	 * Called when the guard needs a user decision for a tool call.
	 * Resolves with the user's choice.
	 */
	requestPermission: (req: PermissionRequest) => Promise<UserDecision>;
}

export class Guard {
	constructor(private cfg: GuardConfig) {}

	async review(
		tool: Tool,
		args: ToolArgs,
		_ctx: ToolContext,
	): Promise<Decision> {
		if (!tool.requiresApproval) return "allow";

		// Check DB for a remembered allow_always decision
		if (this.cfg.db) {
			const row = this.cfg.db
				.prepare(
					"SELECT id FROM permissions WHERE tool_name = ? AND decision = 'allow_always' LIMIT 1",
				)
				.get(tool.name);
			if (row) return "allow";
		}

		const requestId = randomUUID();
		const userDecision = await this.cfg.requestPermission({
			requestId,
			turnId: this.cfg.turnId,
			tool: tool.name,
			args,
			description: tool.description,
		});

		if (userDecision === "allow_always" && this.cfg.db) {
			this.cfg.db
				.prepare(
					"INSERT OR REPLACE INTO permissions (id, tool_name, payload_hash, decision, decided_at) VALUES (?, ?, ?, ?, ?)",
				)
				.run(randomUUID(), tool.name, "", "allow_always", Date.now());
		}

		return userDecision === "deny" ? "deny" : "allow";
	}
}
