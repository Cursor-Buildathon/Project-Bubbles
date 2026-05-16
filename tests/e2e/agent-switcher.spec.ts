import { expect, test } from "./fixtures";
import { completeOnboarding, getChatPage } from "./helpers";

test.describe("agent switcher", () => {
	test("shows all 3 preset agents", async ({ app }) => {
		const chatPage = await getChatPage(app);
		await chatPage.waitForLoadState("domcontentloaded");
		await completeOnboarding(chatPage);

		// Open the agent switcher
		await chatPage.locator('[data-testid="agent-switcher-trigger"]').click();

		// Verify all 3 agents are visible
		await expect(
			chatPage.locator('[data-testid="agent-option-bubbles"]'),
		).toBeVisible();
		await expect(
			chatPage.locator('[data-testid="agent-option-coda"]'),
		).toBeVisible();
		await expect(
			chatPage.locator('[data-testid="agent-option-sage"]'),
		).toBeVisible();
	});
});
