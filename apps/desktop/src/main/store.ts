import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import { normalizeAvatarBounds } from "./windows/bounds";

interface StoreSchema {
	avatarBounds: { x: number; y: number; width: number; height: number };
	chatPanelOpen: boolean;
	activeAgentId: string;
	projectRoot: string;
	costCapUsd: number;
	lastConversationId: string;
	lastAgentId: string;
}

const DEFAULTS: StoreSchema = {
	avatarBounds: { x: -1, y: -1, width: 256, height: 280 },
	chatPanelOpen: false,
	activeAgentId: "bubbles",
	projectRoot: "",
	costCapUsd: 5.0,
	lastConversationId: "",
	lastAgentId: "",
};

let cache: StoreSchema | null = null;
let storeFile: string | null = null;

function getStoreFile(): string {
	if (!storeFile) {
		// app.getPath() is only valid after app.whenReady() — so resolve lazily.
		storeFile = join(app.getPath("userData"), "bubbles-store.json");
	}
	return storeFile;
}

function load(): StoreSchema {
	if (cache) return cache;
	let next: StoreSchema = { ...DEFAULTS };
	try {
		const file = getStoreFile();
		if (existsSync(file)) {
			const raw = readFileSync(file, "utf-8");
			next = { ...DEFAULTS, ...JSON.parse(raw) };
		}
	} catch {
		// fall through to defaults on read/parse error
	}
	cache = next;
	return cache;
}

function persist(): void {
	if (!cache) return;
	try {
		const file = getStoreFile();
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, JSON.stringify(cache, null, 2));
	} catch {
		// best-effort; settings just won't survive next launch
	}
}

export function getAvatarBounds(): StoreSchema["avatarBounds"] {
	return normalizeAvatarBounds(load().avatarBounds);
}

export function setAvatarBounds(bounds: StoreSchema["avatarBounds"]): void {
	load().avatarBounds = normalizeAvatarBounds(bounds);
	persist();
}

export function getChatPanelOpen(): boolean {
	return load().chatPanelOpen;
}

export function setChatPanelOpen(open: boolean): void {
	load().chatPanelOpen = open;
	persist();
}

export function getActiveAgentId(): string {
	return load().activeAgentId;
}

export function setActiveAgentId(id: string): void {
	load().activeAgentId = id;
	persist();
}

export function getProjectRoot(): string {
	return load().projectRoot;
}

export function setProjectRoot(root: string): void {
	load().projectRoot = root;
	persist();
}

export function getCostCapUsd(): number {
	return load().costCapUsd;
}

export function setCostCapUsd(cap: number): void {
	load().costCapUsd = cap;
	persist();
}

export function getLastConversationId(): string {
	return load().lastConversationId;
}

export function setLastConversationId(id: string): void {
	load().lastConversationId = id;
	persist();
}

export function getLastAgentId(): string {
	return load().lastAgentId;
}

export function setLastAgentId(id: string): void {
	load().lastAgentId = id;
	persist();
}

export function getSetting<K extends keyof StoreSchema>(
	key: K,
): StoreSchema[K] {
	return load()[key];
}

export function setSetting<K extends keyof StoreSchema>(
	key: K,
	value: StoreSchema[K],
): void {
	load()[key] = value;
	persist();
}
