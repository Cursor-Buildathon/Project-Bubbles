export interface ToolArgs {
	[key: string]: unknown;
}

export interface JsonSchema {
	type: string;
	properties?: Record<string, unknown>;
	required?: string[];
	[key: string]: unknown;
}

export interface ToolContext {
	workspaceRoot: string;
	/** Set to true after plan_mode is approved so tools can tell a plan was shown. */
	planApproved?: boolean;
}

export interface Tool {
	name: string;
	description: string;
	parametersSchema: JsonSchema;
	requiresApproval: boolean;
	invoke(args: ToolArgs, ctx: ToolContext): Promise<string>;
}
