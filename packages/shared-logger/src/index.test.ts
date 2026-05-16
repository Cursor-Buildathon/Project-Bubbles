import { describe, expect, it } from "vitest";
import { createLogger, withTurnId } from "./index";

describe("@bubbles/shared-logger", () => {
	it("createLogger returns pino logger", () => {
		const log = createLogger("test");
		expect(typeof log.info).toBe("function");
	});

	it("createLogger uses silent level in test env", () => {
		const log = createLogger("test");
		// In vitest env VITEST=true so level should be silent
		expect(log.level).toBe("silent");
	});

	it("withTurnId returns a child logger", () => {
		const parent = createLogger("parent");
		const child = withTurnId(parent, "turn-123");
		expect(typeof child.info).toBe("function");
	});

	it("child logger from withTurnId has bindings", () => {
		const parent = createLogger("parent");
		const child = withTurnId(parent, "turn-abc");
		const bindings = child.bindings();
		expect(bindings.turnId).toBe("turn-abc");
	});
});
