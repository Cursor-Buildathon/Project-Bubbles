import { expect, test } from "./fixtures";
import { completeOnboarding, getChatPage, sendChatMessage } from "./helpers";

test.describe("history", () => {
	test("conversation persists across relaunch", async ({ app }) => {
		const chatPage = await getChatPage(app);
		await chatPage.waitForLoadState("domcontentloaded");
		await completeOnboarding(chatPage);

		// Send a unique message
		const uniqueMsg = `persist-test-${Date.now()}`;
		await sendChatMessage(chatPage, uniqueMsg, "TEST MODE");

		// Close app
		await app.close();

		// Relaunch with same userData
		const { _electron } = await import("playwright");
		const app2 = await _electron.launch({
			args: ["."],
			cwd: "apps/desktop",
			env: {
				...process.env,
				BUBBLES_TEST_MODE: "1",
				NODE_ENV: "test",
			},
		});

		const chatPage2 = await getChatPage(app2);
		await chatPage2.waitForLoadState("domcontentloaded");
		await completeOnboarding(chatPage2);

		// The unique message should still be visible
		await expect(
			chatPage2
				.locator('[data-testid="chat-message"]')
				.filter({ hasText: uniqueMsg }),
		).toBeVisible({ timeout: 10_000 });

		await app2.close();
	});
});
