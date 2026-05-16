import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import {
	getProjectRoot as getStoredProjectRoot,
	setProjectRoot,
} from "./store";

export function resolveProjectRoot(storeValue?: string): string {
	const root =
		storeValue ??
		getStoredProjectRoot() ??
		join(app.getPath("home"), ".bubbles", "workspace");
	mkdirSync(root, { recursive: true });
	return root;
}

export function ensureProjectRoot(): string {
	const stored = getStoredProjectRoot();
	if (stored) {
		mkdirSync(stored, { recursive: true });
		return stored;
	}
	const fallback = join(app.getPath("home"), ".bubbles", "workspace");
	mkdirSync(fallback, { recursive: true });
	setProjectRoot(fallback);
	return fallback;
}
