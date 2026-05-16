import { describe, expect, it } from "vitest";
import { forAgent, getAllTools } from "./index";
import { planModeTool } from "./planMode";

describe("@bubbles/tool-kit", () => {
	it("getAllTools returns 4 built-ins", () => {
		expect(getAllTools()).toHaveLength(4);
	});

	it("forAgent filters by name", () => {
		const tools = forAgent(["readFile", "listDir"]);
		expect(tools.map((t) => t.name)).toEqual(["readFile", "listDir"]);
	});

	it("plan_mode supports ordered steps for permission previews", async () => {
		expect(planModeTool.parametersSchema.properties?.steps).toEqual({
			type: "array",
			items: { type: "string" },
			description:
				"Optional ordered implementation steps to show in the approval modal.",
		});

		await expect(
			planModeTool.invoke(
				{ plan: "Create the file", steps: ["Draft", "Review"] },
				{ workspaceRoot: "." },
			),
		).resolves.toContain("Draft | Review");
	});
});
