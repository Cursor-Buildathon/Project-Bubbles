import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = {
	packageManager?: string;
	engines?: { node?: string };
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};

type Check = {
	name: string;
	ok: boolean;
	detail: string;
	required?: boolean;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path: string): PackageJson {
	return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function dependencyVersion(pkg: PackageJson, name: string): string | undefined {
	return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
}

function checkExists(name: string, path: string, detail: string): Check {
	return {
		name,
		ok: existsSync(path),
		detail: existsSync(path) ? detail : `missing: ${path}`,
		required: true,
	};
}

const rootPkg = readJson(resolve(root, "package.json"));
const memoryPkg = readJson(resolve(root, "packages/memory-core/package.json"));
const desktopPkg = readJson(resolve(root, "apps/desktop/package.json"));
const nodeMajor = Number.parseInt(
	process.versions.node.split(".")[0] ?? "0",
	10,
);
const expectedPnpm = rootPkg.packageManager ?? "pnpm";
const expectedPnpmUserAgent = expectedPnpm.replace("@", "/");
const userAgent = process.env.npm_config_user_agent ?? "unknown";
const sqliteVersion =
	dependencyVersion(memoryPkg, "better-sqlite3") ?? "unknown";
const sqliteStoreVersion = sqliteVersion.replace(/^[^\d]*/, "");
const electronVersion = dependencyVersion(desktopPkg, "electron") ?? "unknown";
const nodeCachePath = resolve(
	root,
	`scripts/native-cache/node-v${process.versions.modules}/build/Release/better_sqlite3.node`,
);
const electronCachePath = resolve(
	root,
	"scripts/native-cache/electron-v128/build/Release/better_sqlite3.node",
);
const pnpmStoreSqlitePath = resolve(
	root,
	`node_modules/.pnpm/better-sqlite3@${sqliteStoreVersion}/node_modules/better-sqlite3/build/Release/better_sqlite3.node`,
);

const checks: Check[] = [
	{
		name: "node",
		ok: nodeMajor >= 22,
		detail: `current ${process.versions.node}; required ${rootPkg.engines?.node ?? ">=22"}`,
		required: true,
	},
	{
		name: "pnpm",
		ok:
			userAgent.includes(expectedPnpm) ||
			userAgent.includes(expectedPnpmUserAgent),
		detail: `expected ${expectedPnpm}; runner ${userAgent}`,
		required: false,
	},
	{
		name: "electron",
		ok: electronVersion.startsWith("^32") || electronVersion.startsWith("32"),
		detail: `apps/desktop uses electron ${electronVersion}`,
		required: true,
	},
	{
		name: "better-sqlite3",
		ok: sqliteVersion.includes("12.9.0"),
		detail: `packages/memory-core uses better-sqlite3 ${sqliteVersion}`,
		required: true,
	},
	checkExists(
		"sqlite node cache",
		nodeCachePath,
		`found cached Node ABI ${process.versions.modules} binary`,
	),
	checkExists(
		"sqlite electron cache",
		electronCachePath,
		"found cached Electron 32 ABI 128 binary",
	),
	checkExists(
		"sqlite selected binary",
		pnpmStoreSqlitePath,
		"found selected better-sqlite3 binary in pnpm store",
	),
	checkExists(
		"electron install",
		resolve(root, "node_modules/electron"),
		"found Electron package install",
	),
];

let failed = false;

for (const check of checks) {
	const status = check.ok ? "ok" : check.required ? "fail" : "warn";
	process.stdout.write(`${status}: ${check.name} - ${check.detail}\n`);
	if (!check.ok && check.required) {
		failed = true;
	}
}

if (failed) {
	process.stderr.write(
		"\nRun `pnpm install`, `node scripts/select-sqlite-binary.mjs --node`, or `pnpm --filter @bubbles/desktop rebuild` depending on the failed check.\n",
	);
	process.exit(1);
}
