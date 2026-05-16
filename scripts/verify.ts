import { spawnSync } from "node:child_process";

function run(cmd: string): void {
	const result = spawnSync(cmd, {
		stdio: "inherit",
		shell: true,
		env: process.env,
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

run("pnpm typecheck");
run("pnpm lint");
run("pnpm test");
run("pnpm e2e");
