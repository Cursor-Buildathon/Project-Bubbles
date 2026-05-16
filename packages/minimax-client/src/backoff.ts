const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 8_000;

function jitteredDelay(attempt: number): number {
	const expo = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
	return expo * (0.5 + Math.random() * 0.5);
}

function isRetryable(status: number, err?: unknown): boolean {
	if (status === 429 || status >= 500) return true;
	// Retry on transient network errors (no status = fetch/connection failure)
	if (status === 0 && err instanceof Error) {
		const msg = err.message.toLowerCase();
		return (
			msg.includes("fetch") ||
			msg.includes("network") ||
			msg.includes("timeout") ||
			msg.includes("econnreset") ||
			msg.includes("etimedout") ||
			msg.includes("enotfound")
		);
	}
	return false;
}

/**
 * Wraps an async factory function with jittered-exponential retry logic
 * for HTTP 429 / 5xx responses.
 *
 * The factory receives the attempt index (0-based) and should throw an
 * object with a numeric `status` property on transient failures.
 */
export async function withBackoff<T>(
	fn: (attempt: number) => Promise<T>,
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		try {
			return await fn(attempt);
		} catch (err) {
			lastError = err;
			const status =
				err instanceof Object && "status" in err
					? (err as { status: number }).status
					: 0;
			if (!isRetryable(status, err) || attempt === MAX_ATTEMPTS - 1) throw err;
			await new Promise((r) => setTimeout(r, jitteredDelay(attempt)));
		}
	}
	throw lastError;
}
