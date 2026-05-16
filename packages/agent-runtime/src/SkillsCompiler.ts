import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CompiledAgent {
	id: string;
	name: string;
	model: string;
	voice: string;
	tools: string[];
	systemPrompt: string;
}

/** Extract YAML frontmatter value for a given key (single-line values only). */
function fmValue(fm: string, key: string): string | undefined {
	const match = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
	return match?.[1]?.trim();
}

/** Extract list items under a YAML key. */
function fmList(fm: string, key: string): string[] {
	const keyIdx = fm.indexOf(`${key}:`);
	if (keyIdx === -1) return [];
	const after = fm.slice(keyIdx + key.length + 1);
	const items: string[] = [];
	for (const line of after.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("-")) {
			items.push(trimmed.slice(1).trim());
		} else if (trimmed.includes(":")) {
			break; // Hit another key
		}
	}
	return items;
}

/** Extract a markdown section body (everything between ## heading and next heading). */
function section(md: string, heading: string): string {
	const re = new RegExp(`^#{1,3}\\s+${heading}\\s*$`, "mi");
	const match = re.exec(md);
	if (!match) return "";
	const start = match.index + match[0].length;
	const rest = md.slice(start);
	const nextHeading = rest.search(/^#{1,3}\s/m);
	return (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
}

export function compileAgent(agentId: string): CompiledAgent | null {
	const base = join(homedir(), ".bubbles", "agents", agentId);
	const skillsPath = join(base, "skills.md");

	if (!existsSync(skillsPath)) return null;

	const raw = readFileSync(skillsPath, "utf-8");

	// Parse frontmatter between first --- delimiters
	const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
	const fm = fmMatch?.[1] ?? "";
	const body = fmMatch ? raw.slice(fmMatch[0].length).trim() : raw;

	const name = fmValue(fm, "name") ?? agentId;
	const model = fmValue(fm, "model") ?? "MiniMax-Text-01";
	const voice = fmValue(fm, "voice") ?? "default";
	const tools = fmList(fm, "tools");

	const personality = section(body, "Personality");
	const capabilities = section(body, "Capabilities");
	const rules = section(body, "Rules");

	const parts: string[] = [`You are ${name}, a desktop AI assistant.`];
	if (personality) parts.push(personality);
	if (capabilities) parts.push(`\n## Capabilities\n${capabilities}`);
	if (rules) parts.push(`\n## Rules\n${rules}`);

	return {
		id: agentId,
		name,
		model,
		voice,
		tools,
		systemPrompt: parts.join("\n\n"),
	};
}
