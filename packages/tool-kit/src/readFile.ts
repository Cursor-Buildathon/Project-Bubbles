import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Tool, ToolArgs, ToolContext } from "./Tool";

export const readFileTool: Tool = {
	name: "readFile",
	description:
		"Read a file from the workspace. Path is relative to the workspace root.",
	parametersSchema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Relative path to the file within the workspace.",
			},
		},
		required: ["path"],
	},
	requiresApproval: false,
	async invoke(args: ToolArgs, ctx: ToolContext): Promise<string> {
		const relPath = String(args.path ?? "");
		const absPath = resolve(join(ctx.workspaceRoot, relPath));
		if (!absPath.startsWith(resolve(ctx.workspaceRoot))) {
			return "Error: path escapes workspace root";
		}
		if (!existsSync(absPath)) {
			return `Error: file not found: ${relPath}`;
		}
		try {
			const content = readFileSync(absPath, "utf-8");
			return content.length > 8000
				? `${content.slice(0, 8000)}\n[truncated — ${content.length} bytes total]`
				: content;
		} catch (err) {
			return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
};
