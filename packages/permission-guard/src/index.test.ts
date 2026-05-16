import { describe, expect, it } from "vitest";
import { Guard } from "./index";

describe("@bubbles/permission-guard", () => {
	it("auto-allows tools that do not require approval", async () => {
		const guard = new Guard({
			turnId: "00000000-0000-0000-0000-000000000001",
			requestPermission: async () => "allow",
		});
		const fakeTool = {
			name: "readFile",
			description: "read",
			parametersSchema: { type: "object" as const },
			requiresApproval: false,
			invoke: async () => "",
		};
		const decision = await guard.review(
			fakeTool,
			{},
			{ workspaceRoot: "/tmp" },
		);
		expect(decision).toBe("allow");
	});

	it("still asks for writeFile approval after plan_mode", async () => {
		const guard = new Guard({
			turnId: "00000000-0000-0000-0000-000000000002",
			requestPermission: async (req) =>
				req.tool === "writeFile" ? "deny" : "allow",
		});
		const fakeTool = {
			name: "writeFile",
			description: "write",
			parametersSchema: { type: "object" as const },
			requiresApproval: true,
			invoke: async () => "",
		};
		const ctx = { workspaceRoot: "/tmp", planApproved: true };
		const decision = await guard.review(fakeTool, {}, ctx);
		expect(decision).toBe("deny");
	});
});
