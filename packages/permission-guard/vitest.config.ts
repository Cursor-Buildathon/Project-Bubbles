import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
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
