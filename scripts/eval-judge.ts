import { runEvalHarness } from "../tests/agent-eval/judge";

const args = process.argv.slice(2);
const live = args.includes("--live");
const datasetPath = args
	.find((a) => a.startsWith("--dataset="))
	?.slice("--dataset=".length);

if (live) {
	process.stdout.write(
		"agent-eval: live mode requested but not yet wired to real agent loop\n",
	);
	process.stdout.write(
		"agent-eval: falling back to deterministic test mode\n\n",
	);
}

runEvalHarness(undefined, datasetPath).then((result) => {
	if (result.total === 0) {
		process.exit(0); // empty dataset = skip
	}
	process.exit(result.average >= 4.0 ? 0 : 1);
});
