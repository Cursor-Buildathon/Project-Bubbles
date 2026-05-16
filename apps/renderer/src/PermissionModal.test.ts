import { describe, expect, it } from "vitest";
import { extractPlanSteps } from "./PermissionModal";

describe("extractPlanSteps", () => {
	it("uses explicit plan_mode steps when provided", () => {
		expect(
			extractPlanSteps({
				plan: "Create a file",
				steps: ["Draft content", "Preview diff", "Write file"],
			}),
		).toEqual(["Draft content", "Preview diff", "Write file"]);
	});

	it("splits numbered plan strings into list items", () => {
		expect(
			extractPlanSteps({
				plan: "1. Draft content\n2. Preview diff\n3. Write file",
			}),
		).toEqual(["Draft content", "Preview diff", "Write file"]);
	});
});
