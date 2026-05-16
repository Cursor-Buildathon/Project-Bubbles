import { expect, test } from "./fixtures";
import { completeOnboarding, getChatPage } from "./helpers";

test.describe("onboarding", () => {
	test("wizard appears for fresh user and can be completed", async ({
		app,
	}) => {
		const chatPage = await getChatPage(app);
		await chatPage.waitForLoadState("domcontentloaded");

		// Wizard should be visible for fresh userData
		const wizard = chatPage.locator('[data-testid="onboarding-wizard"]');
		await expect(wizard).toBeVisible({ timeout: 10_000 });

		// Complete the wizard
		await completeOnboarding(chatPage);

		// Wizard should disappear and chat input should be visible
		await expect(wizard).toBeHidden();
		await expect(chatPage.locator('[data-testid="chat-input"]')).toBeVisible();
	});
});
