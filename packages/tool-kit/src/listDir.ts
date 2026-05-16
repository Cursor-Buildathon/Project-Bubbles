import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Tool, ToolArgs, ToolContext } from "./Tool";

export const listDirTool: Tool = {
	name: "listDir",
	description: "List files and directories within the workspace.",
	parametersSchema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description:
					"Relative directory path within the workspace. Defaults to workspace root.",
			},
		},
		required: [],
	},
	requiresApproval: false,
	async invoke(args: ToolArgs, ctx: ToolContext): Promise<string> {
		const relPath = String(args.path ?? "");
		const absPath = resolve(join(ctx.workspaceRoot, relPath));
		if (!absPath.startsWith(resolve(ctx.workspaceRoot))) {
			return "Error: path escapes workspace root";
		}
		if (!existsSync(absPath)) {
			return `Directory not found: ${relPath || "."}`;
		}
		try {
			const entries = readdirSync(absPath);
			if (entries.length === 0) return "(empty directory)";
			return entries
				.map((e) => {
					const full = join(absPath, e);
					return statSync(full).isDirectory() ? `${e}/` : e;
				})
				.join("\n");
		} catch (err) {
			return `Error listing directory: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
};
