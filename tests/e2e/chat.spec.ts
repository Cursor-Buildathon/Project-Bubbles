import { expect, test } from "./fixtures";
import { completeOnboarding, getChatPage, sendChatMessage } from "./helpers";

test.describe("chat", () => {
	test("sends a message and receives a test-mode response", async ({ app }) => {
		const chatPage = await getChatPage(app);
		await chatPage.waitForLoadState("domcontentloaded");
		await completeOnboarding(chatPage);

		await sendChatMessage(chatPage, "hi", "Bubbles");

		// Verify the user message is rendered
		const messages = chatPage.locator('[data-testid="chat-message"]');
		await expect(messages.filter({ hasText: "hi" })).toBeVisible();
	});

	test("2+2 math query returns correct answer", async ({ app }) => {
		const chatPage = await getChatPage(app);
		await chatPage.waitForLoadState("domcontentloaded");
		await completeOnboarding(chatPage);

		await sendChatMessage(chatPage, "what's 2+2?", "4");
	});
});
