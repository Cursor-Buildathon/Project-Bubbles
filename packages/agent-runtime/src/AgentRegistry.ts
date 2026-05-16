import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AgentConfigSchema } from "@bubbles/shared-types";

export interface AgentSummary {
	id: string;
	name: string;
	tint: number;
	defaultMood: string;
}

function agentsDir(): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
	return join(home, ".bubbles", "agents");
}

export function listAgents(): AgentSummary[] {
	const base = agentsDir();
	if (!existsSync(base)) return [];

	const results: AgentSummary[] = [];
	for (const entry of readdirSync(base, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const configPath = join(base, entry.name, "config.json");
		if (!existsSync(configPath)) continue;

		try {
			const raw = JSON.parse(readFileSync(configPath, "utf-8"));
			const parsed = AgentConfigSchema.parse(raw);
			results.push({
				id: parsed.id,
				name: parsed.name,
				tint: parsed.tint,
				defaultMood: parsed.defaultMood,
			});
		} catch {
			// Malformed config — skip silently
		}
	}
	return results;
}

export function getAgent(id: string): AgentSummary | null {
	return listAgents().find((a) => a.id === id) ?? null;
}
