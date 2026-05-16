import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globalSetup: "../memory-core/vitest.globalSetup.ts",
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			text: [70, 70],
			lines: 70,
			functions: 70,
			branches: 70,
		},
	},
});
