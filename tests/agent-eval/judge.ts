import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const datasetPath = join(dir, "dataset.jsonl");

/**
 * LLM-as-judge harness (Phase 4+). Empty `dataset.jsonl` exits successfully.
 */
export function runEvalHarness(): void {
	const raw = readFileSync(datasetPath, "utf-8").trim();
	if (!raw) {
		process.stdout.write("agent-eval: empty dataset, skip\n");
		return;
	}
	process.stdout.write(
		"agent-eval: non-empty dataset present; judge loop not wired until Phase 4+\n",
	);
}
