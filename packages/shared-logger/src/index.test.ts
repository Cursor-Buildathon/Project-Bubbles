import { describe, expect, it } from "vitest";
import { createLogger, hello } from "./index";

describe("@bubbles/shared-logger", () => {
	it("hello", () => {
		expect(hello()).toBe("hello");
	});

	it("createLogger returns pino logger", () => {
		const log = createLogger("test");
		expect(typeof log.info).toBe("function");
	});
});
