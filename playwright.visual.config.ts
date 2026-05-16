import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	testDir: path.join(rootDir, "tests", "visual"),
	timeout: 60_000,
	fullyParallel: false,
	workers: 1,
	reporter: [["list"]],
	snapshotPathTemplate: "{testDir}/snapshots/{projectName}/{arg}{ext}",
	expect: {
		toHaveScreenshot: {
			maxDiffPixels: 50,
			threshold: 0.2,
		},
	},
});
