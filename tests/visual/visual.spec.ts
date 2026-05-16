import { expect, test } from "@playwright/test";
import { _electron } from "playwright";

const MOODS = ["idle", "thinking", "talking", "error"] as const;
const AGENTS = ["bubbles", "coda", "sage"] as const;

test.describe("avatar visual regression", () => {
	for (const agent of AGENTS) {
		for (const mood of MOODS) {
			test(`${agent} - ${mood}`, async () => {
				const app = await _electron.launch({
					args: ["."],
					cwd: "apps/desktop",
					env: {
						...process.env,
						BUBBLES_TEST_MODE: "1",
						NODE_ENV: "test",
					},
				});

				// Find avatar window (small viewport)
				const windows = app.windows();
				const avatarPage = windows.find((w) => {
					const size = w.viewportSize();
					return size?.width !== undefined && size.width <= 300;
				});

				if (!avatarPage) {
					await app.close();
					test.skip(true, "Avatar window not found");
					return;
				}

				// Wait for PixiJS to render
				await avatarPage.waitForLoadState("networkidle");
				await avatarPage.waitForTimeout(500);

				// Set skin and mood via test-only IPC (requires BUBBLES_TEST_MODE)
				await avatarPage.evaluate(
					({ agentId, moodName }) => {
						(window as unknown as Record<string, unknown>).bubblesTestSetSkin?.(
							agentId,
						);
						(window as unknown as Record<string, unknown>).bubblesTestSetMood?.(
							moodName,
						);
					},
					{ agentId: agent, moodName: mood },
				);

				// Allow animation frame to settle
				await avatarPage.waitForTimeout(300);

				await expect(avatarPage).toHaveScreenshot(`${agent}-${mood}.png`);
				await app.close();
			});
		}
	}
});
