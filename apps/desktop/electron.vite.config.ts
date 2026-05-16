import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import type { PluginOption } from "vite";

export default defineConfig({
	main: {
		plugins: [
			externalizeDepsPlugin({
				exclude: [
					"@bubbles/agent-runtime",
					"@bubbles/shared-logger",
					"@bubbles/shared-types",
					"@bubbles/memory-core",
					"@bubbles/minimax-client",
					"@bubbles/cost-meter",
					"@bubbles/tool-kit",
					"@bubbles/permission-guard",
				],
			}),
		],
		build: {
			rollupOptions: {
				// better-sqlite3 is a native addon — its bindings module uses
				// __dirname lookups that break when inlined into the ESM bundle.
				// Keep it external so Node resolves it from node_modules at runtime.
				external: ["better-sqlite3"],
				output: {
					// Force CJS output for the main process. Electron 32's main-process
					// ESM loader can't resolve named imports from the `electron` module
					// (e.g. `import { app } from "electron"`), which crashes during
					// CJS-to-ESM translation. Outputting CJS sidesteps the issue without
					// requiring source-level rewrites.
					format: "cjs",
					entryFileNames: "[name].cjs",
				},
			},
		},
	},
	preload: {
		plugins: [
			externalizeDepsPlugin({
				exclude: ["@bubbles/shared-types"],
			}),
		],
	},
	renderer: {
		root: resolve(__dirname, "../renderer"),
		build: {
			rollupOptions: {
				input: resolve(__dirname, "../renderer/index.html"),
			},
		},
		plugins: [react(), tailwindcss() as unknown as PluginOption],
	},
});
