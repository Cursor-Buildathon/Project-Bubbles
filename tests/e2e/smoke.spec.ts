import { expect, test } from "@playwright/test";
import { _electron } from "playwright";

test.describe("smoke", () => {
	test("electron window opens with Bubbles title", async () => {
		const app = await _electron.launch({
			args: ["."],
			cwd: "apps/desktop",
			env: {
				...process.env,
				BUBBLES_TEST_MODE: "1",
				NODE_ENV: "test",
			},
		});

		const window = await app.firstWindow({ timeout: 30_000 });
		await expect(window).toHaveTitle(/Bubbles/i);
		await app.close();
	});
});
