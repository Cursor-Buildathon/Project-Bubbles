/**
 * CLI wrapper: seeds ~/.bubbles/agents/ from assets/sprites/presets.json.
 * Usage: pnpm seed-presets
 */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function assetsDir(): string {
	return join(ROOT, "assets");
}

function agentsDir(): string {
	return join(homedir(), ".bubbles", "agents");
}

interface PresetDef {
	id: string;
	name: string;
	tint: number;
	atlas: string;
	defaultMood: string;
}

function buildSkillsMd(preset: PresetDef): string {
	const roleSkills: Record<
		string,
		{
			tools: string[];
			personality: string;
			capabilities: string;
			rules: string;
		}
	> = {
		bubbles: {
			tools: ["readFile", "listDir"],
			personality:
				"Bubbly, curious, and warm. You love exploring files and explaining what you find in a friendly, accessible way.",
			capabilities:
				"- Read files from the workspace and summarise their contents\n- List directory contents to help navigate the project\n- Answer questions about files, code, and data",
			rules:
				"- Never write or delete files — you are read-only\n- Always tell the user what file you read and why\n- Keep responses concise and friendly",
		},
		coda: {
			tools: ["readFile", "writeFile", "listDir", "plan_mode"],
			personality:
				"Methodical, precise, and collaborative. You believe in showing your work before doing it — always present a plan and wait for approval before writing anything.",
			capabilities:
				"- Read and write files in the workspace\n- Create, edit, and reorganise project files\n- Draft plans and implement them step-by-step",
			rules:
				"- Always call plan_mode before writeFile — never skip the approval step\n- Scope all file operations to the workspace root\n- Confirm with the user if the intended change seems destructive",
		},
		sage: {
			tools: ["readFile"],
			personality:
				"Wise, measured, and thorough. You read deeply and explain carefully, drawing connections across files and concepts.",
			capabilities:
				"- Read and analyse files from the workspace\n- Provide detailed explanations, summaries, and insights\n- Answer questions grounded in the actual file contents",
			rules:
				"- Cite the file and line range when referencing content\n- Do not guess — if you cannot read a file, say so\n- Keep explanations structured and easy to follow",
		},
	};

	const role = roleSkills[preset.id] ?? roleSkills.bubbles;

	const toolsYaml = role.tools.length
		? `tools:\n${role.tools.map((t) => `  - ${t}`).join("\n")}`
		: "";

	return [
		"---",
		`name: ${preset.name}`,
		"role: general",
		"voice: default",
		`model: MiniMax-Text-01`,
		toolsYaml,
		"---",
		"",
		"# Personality",
		role.personality,
		"",
		"# Capabilities",
		role.capabilities,
		"",
		"# Rules",
		role.rules,
		"",
	].join("\n");
}

const presetsJsonPath = join(assetsDir(), "sprites", "presets.json");
if (!existsSync(presetsJsonPath)) {
	process.stderr.write(`presets.json not found at ${presetsJsonPath}\n`);
	process.exit(1);
}

const presets: PresetDef[] = JSON.parse(readFileSync(presetsJsonPath, "utf-8"));
const base = agentsDir();
mkdirSync(base, { recursive: true });

for (const preset of presets) {
	const agentDir = join(base, preset.id);
	const configPath = join(agentDir, "config.json");

	mkdirSync(join(agentDir, "sprites"), { recursive: true });

	// Always refresh skills.md so personality/tools stay up to date
	writeFileSync(join(agentDir, "skills.md"), buildSkillsMd(preset));

	if (existsSync(configPath)) {
		process.stdout.write(`[refreshed skills] ${preset.id}\n`);
		continue;
	}

	const srcSheet = join(assetsDir(), "sprites", "bubbles", "spritesheet.png");
	const srcJson = join(assetsDir(), "sprites", "bubbles", "spritesheet.json");
	copyFileSync(srcSheet, join(agentDir, "sprites", "spritesheet.png"));
	copyFileSync(srcJson, join(agentDir, "sprites", "spritesheet.json"));

	writeFileSync(
		configPath,
		JSON.stringify(
			{
				id: preset.id,
				name: preset.name,
				tint: preset.tint,
				atlas: preset.atlas,
				defaultMood: preset.defaultMood,
			},
			null,
			2,
		),
	);

	process.stdout.write(`[seeded] ${preset.id}\n`);
}
