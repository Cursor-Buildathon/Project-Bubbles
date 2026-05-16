import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(name: string): Logger {
	const level =
		process.env.NODE_ENV === "test" || process.env.VITEST === "true"
			? "silent"
			: (process.env.LOG_LEVEL ?? "info");
	return pino({ name, level });
}

/**
 * Returns a child logger with `turnId` bound to every log line.
 * Use in IPC handlers to correlate log entries across a single agent turn.
 */
export function withTurnId(logger: Logger, turnId: string): Logger {
	return logger.child({ turnId });
}
