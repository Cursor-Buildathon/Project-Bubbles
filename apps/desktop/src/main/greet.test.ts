import { describe, expect, it } from "vitest";
import { greet } from "./greet";

describe("desktop main helpers", () => {
	it("greet", () => {
		expect(greet()).toBe("hello-from-main");
	});
});
