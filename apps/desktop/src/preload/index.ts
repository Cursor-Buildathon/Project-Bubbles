import { contextBridge } from "electron";

const api = {
	ping: (): string => "pong",
};

contextBridge.exposeInMainWorld("bubbles", api);

export type BubblesPreloadAPI = typeof api;
