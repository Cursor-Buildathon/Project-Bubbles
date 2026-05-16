import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Tool, ToolArgs, ToolContext } from "./Tool";

export const writeFileTool: Tool = {
	name: "writeFile",
	description:
		"Write content to a file in the workspace. Creates parent directories as needed. Always requires user approval with a preview.",
	parametersSchema: {
		type: "object",
		properties: {
			path: {
				type: "string",
				description: "Relative path to the file within the workspace.",
			},
			content: {
				type: "string",
				description: "Content to write to the file.",
			},
		},
		required: ["path", "content"],
	},
	requiresApproval: true,
	async invoke(args: ToolArgs, ctx: ToolContext): Promise<string> {
		const relPath = String(args.path ?? "");
		const content = String(args.content ?? "");
		const absPath = resolve(join(ctx.workspaceRoot, relPath));
		const scoped = relative(resolve(ctx.workspaceRoot), absPath);
		if (scoped.startsWith("..") || isAbsolute(scoped)) {
			return "Error: path escapes workspace root";
		}
		try {
			mkdirSync(dirname(absPath), { recursive: true });
			writeFileSync(absPath, content, "utf-8");
			return `Written ${content.length} bytes to ${relPath}`;
		} catch (err) {
			return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
		}
	},
};
