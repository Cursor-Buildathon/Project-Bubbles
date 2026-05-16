let _apiKey: string | null = null;

/**
 * Set the MiniMax API key. Called from the Electron main process after
 * reading the value from `safeStorage`.
 */
export function setApiKey(key: string): void {
	_apiKey = key;
}

/**
 * Retrieve the stored API key.
 * Throws if no key has been set yet.
 */
export function getApiKey(): string {
	if (!_apiKey) {
		throw new Error(
			"MiniMax API key not set. Call setApiKey() from the main process after reading from safeStorage.",
		);
	}
	return _apiKey;
}

/** Clear the stored key (e.g. on logout). */
export function clearApiKey(): void {
	_apiKey = null;
}
