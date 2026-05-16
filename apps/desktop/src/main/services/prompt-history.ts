import { readFileSync, writeFileSync } from "node:fs";
import type { ImageGenResult } from "@bubbles/shared-types";

const MAX_ENTRIES = 200;

interface HistoryFile {
	entries: ImageGenResult[];
}

function readHistoryFile(filePath: string): HistoryFile {
	try {
		const raw = readFileSync(filePath, "utf-8");
		return JSON.parse(raw) as HistoryFile;
	} catch {
		return { entries: [] };
	}
}

function writeHistoryFile(filePath: string, data: HistoryFile): void {
	writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function loadHistory(filePath: string): ImageGenResult[] {
	return readHistoryFile(filePath).entries;
}

export function appendToHistory(
	filePath: string,
	entry: ImageGenResult,
): void {
	const data = readHistoryFile(filePath);
	data.entries.unshift(entry);

	if (data.entries.length > MAX_ENTRIES) {
		const favorites = data.entries.filter((e) => e.favorite);
		const nonFavorites = data.entries.filter((e) => !e.favorite);
		const keepNonFavorites = nonFavorites.slice(
			0,
			MAX_ENTRIES - favorites.length,
		);
		data.entries = [
			...favorites,
			...keepNonFavorites,
		].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	}

	writeHistoryFile(filePath, data);
}

export function toggleFavorite(filePath: string, id: string): boolean {
	const data = readHistoryFile(filePath);
	const entry = data.entries.find((e) => e.id === id);
	if (!entry) return false;
	entry.favorite = !entry.favorite;
	writeHistoryFile(filePath, data);
	return entry.favorite;
}
