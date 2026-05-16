/**
 * Copy the correct better-sqlite3 native binary into the pnpm store
 * based on the current runtime (Node vs Electron).
 *
 * This solves the dual-ABI problem where:
 *   - Vitest runs on system Node (e.g. ABI 137)
 *   - Electron 32 runs on its bundled Node (ABI 128)
 *
 * Prebuilt binaries are cached in scripts/native-cache/ and copied
 * into the pnpm store's build/Release/ directory.
 *
 * Usage:
 *   node scripts/select-sqlite-binary.mjs           # auto-detects Node/Electron
 *   node scripts/select-sqlite-binary.mjs --electron # force Electron binary
 *   node scripts/select-sqlite-binary.mjs --node     # force Node binary
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pnpmStorePath = resolve(
	root,
	"node_modules/.pnpm/better-sqlite3@12.9.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
);

const cacheDir = resolve(root, "scripts/native-cache");

function selectBinary() {
	const forceElectron = process.argv.includes("--electron");
	const forceNode = process.argv.includes("--node");
	const isElectron =
		forceElectron || (!forceNode && !!process.versions.electron);
	const abi = process.versions.modules;
	const platform = process.platform;
	const arch = process.arch;

	let sourceName;
	if (isElectron) {
		// Electron 32 uses ABI 128, not the system Node ABI.
		// Hard-code the known Electron ABI so this works even when
		// the script is launched from system Node (e.g. dev.mjs).
		const electronAbi = "128";
		sourceName = `electron-v${electronAbi}`;
	} else {
		sourceName = `node-v${abi}`;
	}

	const sourcePath = resolve(
		cacheDir,
		sourceName,
		"build/Release/better_sqlite3.node",
	);

	if (!existsSync(sourcePath)) {
		process.stderr.write(
			`select-sqlite-binary: no cached binary for ${sourceName} (${platform}-${arch})\n` +
				`  looked in: ${sourcePath}\n` +
				`  Please download the prebuilt from https://github.com/WiseLibs/better-sqlite3/releases\n`,
		);
		process.exit(1);
	}

	mkdirSync(dirname(pnpmStorePath), { recursive: true });
	copyFileSync(sourcePath, pnpmStorePath);
	process.stdout.write(
		`select-sqlite-binary: copied ${sourceName} → ${pnpmStorePath}\n`,
	);
}

selectBinary();
