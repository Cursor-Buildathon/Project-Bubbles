import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const bsDir = resolve(
	__dirname,
	"../../node_modules/.pnpm/better-sqlite3@12.9.0/node_modules/better-sqlite3",
);

function downloadBinary(runtime: string, target: string): void {
	if (!existsSync(bsDir)) return;
	const prebuildInstall =
		process.platform === "win32"
			? resolve(bsDir, "node_modules/.bin/prebuild-install.cmd")
			: resolve(bsDir, "node_modules/.bin/prebuild-install");
	if (!existsSync(prebuildInstall)) return;
	const result = spawnSync(
		prebuildInstall,
		["--runtime", runtime, "--target", target],
		{ cwd: bsDir, stdio: "pipe", shell: false },
	);
	if (result.status !== 0) {
		process.stderr.write(
			`[vitest-globalSetup] better-sqlite3 prebuilt download failed for ${runtime}@${target}: ${result.stderr?.toString() ?? "unknown"}\n`,
		);
	}
}

export function setup(): void {
	downloadBinary("node", process.versions.node);
}

export function teardown(): void {
	downloadBinary("electron", "32.0.0");
}
