import { listDirTool } from "./listDir";
import { planModeTool } from "./planMode";
import { readFileTool } from "./readFile";
import type { Tool } from "./Tool";
import { writeFileTool } from "./writeFile";

const ALL_TOOLS: Tool[] = [
	readFileTool,
	writeFileTool,
	listDirTool,
	planModeTool,
];

export function getAllTools(): Tool[] {
	return ALL_TOOLS;
}

export function forAgent(allowedNames: string[]): Tool[] {
	const nameSet = new Set(allowedNames);
	return ALL_TOOLS.filter((t) => nameSet.has(t.name));
}
