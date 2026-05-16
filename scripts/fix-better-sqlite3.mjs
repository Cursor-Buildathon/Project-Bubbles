/**
 * Ensure better-sqlite3 prebuilt binaries are present for BOTH:
 *   1. The system Node (used by Vitest and pnpm scripts)
 *   2. Electron 32 (used at app runtime)
 *
 * Background: Cursor bundles its own Node (v23.x / MODULE_VERSION=128) which
 * pnpm lifecycle scripts can pick up for native builds. This causes the
 * initial `prebuild-install` run to download a binary for the wrong Node.
 * Running both downloads explicitly ensures correct binaries are available.
 *
 * If a prebuilt for the current Node version does not exist, we fall back
 * to building from source via `npm rebuild`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bsDir = resolve(
	root,
	"node_modules/.pnpm/better-sqlite3@12.9.0/node_modules/better-sqlite3",
);

if (!existsSync(bsDir)) {
	process.stdout.write("fix-better-sqlite3: package not installed yet, skip\n");
	process.exit(0);
}

const prebuiltBin = existsSync(
	resolve(bsDir, "node_modules/.bin/prebuild-install.cmd"),
)
	? resolve(bsDir, "node_modules/.bin/prebuild-install.cmd")
	: resolve(bsDir, "node_modules/.bin/prebuild-install");

function download(runtime, target) {
	if (!existsSync(prebuiltBin)) {
		process.stdout.write(
			"fix-better-sqlite3: prebuild-install not found, skip download\n",
		);
		return false;
	}
	process.stdout.write(
		`fix-better-sqlite3: downloading prebuilt for ${runtime}@${target}\n`,
	);
	const result = spawnSync(
		prebuiltBin,
		["--runtime", runtime, "--target", target],
		{ cwd: bsDir, stdio: "inherit", shell: false },
	);
	if (result.status !== 0) {
		process.stderr.write(
			`fix-better-sqlite3: warning — download failed for ${runtime}@${target}\n`,
		);
		return false;
	}
	return true;
}

function rebuildFromSource() {
	process.stdout.write(
		"fix-better-sqlite3: falling back to build from source for current Node\n",
	);
	const result = spawnSync("npm", ["rebuild"], {
		cwd: bsDir,
		stdio: "inherit",
		shell: true,
	});
	if (result.status !== 0) {
		process.stderr.write(
			"fix-better-sqlite3: warning — source rebuild failed\n",
		);
		return false;
	}
	return true;
}

// System Node version (for Vitest)
const nodeOk = download("node", process.versions.node);
if (!nodeOk) {
	rebuildFromSource();
}

// Electron runtime (for the Electron main process)
download("electron", "32.0.0");

process.exit(0);
