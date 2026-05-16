import type { Tool, ToolArgs, ToolContext } from "./Tool";

export const planModeTool: Tool = {
	name: "plan_mode",
	description:
		"Present a plan to the user for approval before making any file changes. Always call this before writeFile to show the user what you intend to do. Approval of this plan does not skip the writeFile preview.",
	parametersSchema: {
		type: "object",
		properties: {
			plan: {
				type: "string",
				description:
					"A clear description of the changes you intend to make and why.",
			},
			steps: {
				type: "array",
				items: { type: "string" },
				description:
					"Optional ordered implementation steps to show in the approval modal.",
			},
		},
		required: ["plan"],
	},
	requiresApproval: true,
	async invoke(args: ToolArgs, ctx: ToolContext): Promise<string> {
		ctx.planApproved = true;
		const steps = Array.isArray(args.steps)
			? args.steps.map((step) => String(step)).filter(Boolean)
			: [];
		const suffix = steps.length ? ` Steps: ${steps.join(" | ")}` : "";
		return `Plan approved. Proceeding: ${String(args.plan ?? "")}${suffix}`;
	},
};
