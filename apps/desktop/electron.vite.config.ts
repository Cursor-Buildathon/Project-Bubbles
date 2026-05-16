import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
	main: {
		plugins: [
			externalizeDepsPlugin({
				exclude: [
					"@bubbles/shared-logger",
					"@bubbles/shared-types",
					"@bubbles/minimax-client",
				],
			}),
		],
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
	},
	renderer: {
		root: resolve(__dirname, "../renderer"),
		build: {
			rollupOptions: {
				input: resolve(__dirname, "../renderer/index.html"),
			},
		},
		plugins: [react()],
	},
});
