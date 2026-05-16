import { clipboard, contextBridge, ipcRenderer } from "electron";
import type { ImageGenResult } from "@bubbles/shared-types";

export type ImageGenIpcResult = ImageGenResult & { imageDataUrl: string };

const api = {
	ping: (): string => "pong",
	generateImage: (req: {
		userPrompt: string;
		style?: string;
		aspectRatio?: string;
	}): Promise<ImageGenIpcResult> => ipcRenderer.invoke("v1:image:generate", req),
	getImageHistory: (): Promise<ImageGenResult[]> =>
		ipcRenderer.invoke("v1:image:history"),
	toggleFavorite: (id: string): Promise<boolean> =>
		ipcRenderer.invoke("v1:image:toggle-favorite", id),
	loadImageDataUrl: (imagePath: string): Promise<string> =>
		ipcRenderer.invoke("v1:image:load-data", imagePath),
	copyToClipboard: (text: string): void => {
		clipboard.writeText(text);
	},
};

contextBridge.exposeInMainWorld("bubbles", api);

export type BubblesPreloadAPI = typeof api;
