import type { ElectronApplication, Page } from "@playwright/test";

/** Wait for the chat panel page to be available (not the avatar window). */
export async function getChatPage(app: ElectronApplication): Promise<Page> {
	const pages = app.windows();
	// Chat panel usually has larger viewport; avatar is 256x280
	const chatPage = pages.find((p) => {
		const size = p.viewportSize();
		return size?.width !== undefined && size.width > 500;
	});
	if (chatPage) return chatPage;
	// Fallback: wait for a second window
	await app.waitForEvent("window", { timeout: 10_000 });
	return getChatPage(app);
}

/** Wait for the avatar page (small viewport). */
export async function getAvatarPage(app: ElectronApplication): Promise<Page> {
	const pages = app.windows();
	const avatarPage = pages.find((p) => {
		const size = p.viewportSize();
		return size?.width !== undefined && size.width <= 300;
	});
	if (avatarPage) return avatarPage;
	await app.waitForEvent("window", { timeout: 10_000 });
	return getAvatarPage(app);
}

/** Complete onboarding wizard if visible. */
export async function completeOnboarding(page: Page): Promise<void> {
	const wizard = page.locator('[data-testid="onboarding-wizard"]');
	if (await wizard.isVisible().catch(() => false)) {
		// Step 1: Welcome → Next
		await page.locator('[data-testid="onboarding-next"]').click();
		// Step 2: API Key → enter fake key + Next
		await page
			.locator('[data-testid="onboarding-apikey"]')
			.fill("test-key-123");
		await page.locator('[data-testid="onboarding-next"]').click();
		// Step 3: Project folder → Skip (uses default)
		await page.locator('[data-testid="onboarding-finish"]').click();
		await wizard.waitFor({ state: "hidden", timeout: 5_000 });
	}
}

/** Send a chat message and wait for response text. */
export async function sendChatMessage(
	page: Page,
	message: string,
	expectResponseContaining?: string,
): Promise<void> {
	const input = page.locator('[data-testid="chat-input"]');
	await input.fill(message);
	await input.press("Enter");
	if (expectResponseContaining) {
		await page
			.locator('[data-testid="chat-message"]')
			.filter({ hasText: expectResponseContaining })
			.waitFor({ timeout: 10_000 });
	}
}
