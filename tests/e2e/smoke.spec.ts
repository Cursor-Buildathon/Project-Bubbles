import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

test.describe("smoke", () => {
	test("electron window opens with Bubbles title", async () => {
		const { _electron } = await import("playwright");
		const electronPath = require("electron") as string;
		const desktopRoot = path.resolve(__dirname, "../../apps/desktop");

		const app = await _electron.launch({
			executablePath: electronPath,
			args: ["."],
			cwd: desktopRoot,
		});

		const window = await app.firstWindow({ timeout: 30_000 });
		await expect(window).toHaveTitle(/Bubbles/i);
		await app.close();
	});
});
