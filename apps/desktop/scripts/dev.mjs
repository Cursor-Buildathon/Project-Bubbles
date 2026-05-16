// Launcher that deletes ELECTRON_RUN_AS_NODE before spawning electron-vite.
// Some host tools (Cursor, etc.) set this env var globally, which makes
// electron.exe run as a plain Node binary — `require("electron")` then
// returns the binary path string instead of the API object, causing the
// main process to crash on startup.
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "../../..");

// Ensure the Electron-compatible better-sqlite3 binary is in place
// before electron-vite bundles the main process.
const selectBinaryResult = spawnSync(
	process.execPath,
	[resolve(rootDir, "scripts/select-sqlite-binary.mjs"), "--electron"],
	{ stdio: "inherit", shell: false },
);
if (selectBinaryResult.status !== 0) {
	process.stderr.write("Failed to select sqlite binary for Electron\n");
	process.exit(selectBinaryResult.status ?? 1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const isWin = process.platform === "win32";
const cmd = isWin ? "electron-vite.cmd" : "electron-vite";

const child = spawn(cmd, process.argv.slice(2), {
	stdio: "inherit",
	env,
	shell: isWin,
});
child.on("exit", (code) => process.exit(code ?? 1));
