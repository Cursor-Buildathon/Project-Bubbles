import { describe, expect, it } from "vitest";
import {
	AVATAR_WINDOW_SIZE,
	normalizeAvatarBounds,
	resolveVisibleBounds,
} from "./bounds";

const primary = { x: 0, y: 25, width: 1440, height: 875 };

describe("resolveVisibleBounds", () => {
	it("uses bottom-right of the primary display for default bounds", () => {
		expect(
			resolveVisibleBounds({ x: -1, y: -1, width: 256, height: 280 }, primary, [
				primary,
			]),
		).toEqual({ x: 1164, y: 600, width: 256, height: 280 });
	});

	it("moves an off-screen saved position back onto the primary display", () => {
		expect(
			resolveVisibleBounds(
				{ x: 2284, y: 1110, width: 256, height: 280 },
				primary,
				[primary],
			),
		).toEqual({ x: 1164, y: 600, width: 256, height: 280 });
	});

	it("keeps a saved position on an attached secondary display", () => {
		const secondary = { x: 1440, y: 0, width: 1920, height: 1080 };
		expect(
			resolveVisibleBounds(
				{ x: 2284, y: 760, width: 256, height: 280 },
				primary,
				[primary, secondary],
			),
		).toEqual({ x: 2284, y: 760, width: 256, height: 280 });
	});

	it("normalizes oversized saved avatar bounds", () => {
		expect(
			normalizeAvatarBounds({ x: 100, y: 200, width: 900, height: 700 }),
		).toEqual({ x: 100, y: 200, ...AVATAR_WINDOW_SIZE });
	});

	it("resolves oversized saved bounds back to the fixed avatar size", () => {
		expect(
			resolveVisibleBounds(
				{ x: 100, y: 200, width: 900, height: 700 },
				primary,
				[primary],
			),
		).toEqual({ x: 100, y: 200, width: 256, height: 280 });
	});
});
