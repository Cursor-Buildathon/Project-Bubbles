import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	_electron,
	test as base,
	type ElectronApplication,
} from "@playwright/test";

export { expect } from "@playwright/test";

interface BubblesFixtures {
	/** Launched Electron app with temp userData and test mode. */
	app: ElectronApplication;
	/** Temp directory used for userData (cleaned up after test). */
	tempDir: string;
}

export const test = base.extend<BubblesFixtures>({
	tempDir: [
		async (_fixtures, use) => {
			const dir = mkdtempSync(join(tmpdir(), "bubbles-e2e-"));
			await use(dir);
			rmSync(dir, { recursive: true, force: true });
		},
		{ scope: "test" },
	],

	app: [
		async (_context, use) => {
			const electronApp = await _electron.launch({
				args: ["."],
				cwd: "apps/desktop",
				env: {
					...process.env,
					BUBBLES_TEST_MODE: "1",
					NODE_ENV: "test",
				},
			});

			await use(electronApp);
			await electronApp.close();
		},
		{ scope: "test" },
	],
});
