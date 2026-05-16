import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(name: string): Logger {
	const level =
		process.env.NODE_ENV === "test" || process.env.VITEST === "true"
			? "silent"
			: (process.env.LOG_LEVEL ?? "info");
	return pino({ name, level });
}

export function hello(): string {
	return "hello";
}
