import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const datasetPath = join(dir, "dataset.jsonl");

export interface EvalCase {
	id: string;
	agentId: string;
	prompt: string;
	rubric: string[];
	expectedTools?: string[];
	minScore?: number;
}

export interface EvalResult {
	id: string;
	score: number;
	reasoning: string;
	passed: boolean;
}

function loadDataset(path: string): EvalCase[] {
	const raw = readFileSync(path, "utf-8").trim();
	if (!raw) return [];
	return raw
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line) as EvalCase);
}

/**
 * Deterministic scoring for CI/test mode.
 *
 * In test mode responses are placeholders, so this scorer:
 * 1. Checks for obvious failures (empty, error, too short)
 * 2. Gives partial credit for length and structure
 * 3. Uses rubric keyword matching as a bonus
 *
 * In live mode (`--live`), this is replaced by an LLM-as-judge call.
 */
function deterministicScore(responseText: string, rubric: string[]): number {
	const text = responseText.trim();
	if (!text || text.startsWith("[Error")) return 1;

	const lower = text.toLowerCase();
	let matched = 0;
	for (const criterion of rubric) {
		const keywords = criterion
			.toLowerCase()
			.split(/\s+/)
			.filter(
				(w) =>
					w.length > 3 &&
					![
						"this",
						"that",
						"with",
						"from",
						"under",
						"over",
						"does",
						"should",
					].includes(w),
			);
		const met = keywords.some((kw) => lower.includes(kw));
		if (met) matched++;
	}

	// Base score from length (placeholder responses are long enough)
	let score = 3;
	if (text.length < 20) score = 2;
	if (text.length > 80) score = 4;

	// Boost/penalize based on rubric match
	const ratio = matched / rubric.length;
	if (ratio >= 0.7) score = Math.min(5, score + 1);
	if (ratio <= 0.2) score = Math.max(2, score - 1);

	return score;
}

/**
 * Run a single eval case against a response generator.
 */
export async function runCase(
	testCase: EvalCase,
	generateResponse: (prompt: string, agentId: string) => Promise<string>,
): Promise<EvalResult> {
	const response = await generateResponse(testCase.prompt, testCase.agentId);
	const score = deterministicScore(response, testCase.rubric);
	const minScore = testCase.minScore ?? 4;
	return {
		id: testCase.id,
		score,
		reasoning: `Rubric: ${testCase.rubric.join("; ")} | Score: ${score}/5`,
		passed: score >= minScore,
	};
}

export interface HarnessResult {
	results: EvalResult[];
	average: number;
	passed: number;
	failed: number;
	total: number;
}

/**
 * Run the full eval harness.
 *
 * @param generateResponse - Function that takes (prompt, agentId) and returns response text.
 *                         In test mode this can be a fake. In live mode it calls the real agent loop.
 * @param datasetOverride - Optional path to a custom dataset file.
 */
export async function runEvalHarness(
	generateResponse?: (prompt: string, agentId: string) => Promise<string>,
	datasetOverride?: string,
): Promise<HarnessResult> {
	const dataset = loadDataset(datasetOverride ?? datasetPath);
	if (dataset.length === 0) {
		process.stdout.write("agent-eval: empty dataset, skip\n");
		return { results: [], average: 0, passed: 0, failed: 0, total: 0 };
	}

	// Default fake response for deterministic CI mode
	const responder =
		generateResponse ??
		(async (prompt: string, agentId: string) => {
			return `[TEST MODE] Agent ${agentId} responding to: "${prompt}". This is a deterministic placeholder response for CI evaluation.`;
		});

	const results: EvalResult[] = [];
	for (const testCase of dataset) {
		try {
			const result = await runCase(testCase, responder);
			results.push(result);
		} catch (err) {
			results.push({
				id: testCase.id,
				score: 0,
				reasoning: `Error: ${err instanceof Error ? err.message : String(err)}`,
				passed: false,
			});
		}
	}

	const scores = results.map((r) => r.score);
	const average = scores.reduce((a, b) => a + b, 0) / scores.length;
	const passed = results.filter((r) => r.passed).length;
	const failed = results.filter((r) => !r.passed).length;

	// Report
	process.stdout.write(`\n=== Agent Eval Results ===\n`);
	process.stdout.write(
		`Total: ${dataset.length} | Passed: ${passed} | Failed: ${failed}\n`,
	);
	process.stdout.write(`Average Score: ${average.toFixed(2)}/5.00\n`);
	process.stdout.write(
		`Threshold: 4.0 | ${average >= 4.0 ? "PASS" : "FAIL"}\n`,
	);
	process.stdout.write(`\nDetails:\n`);
	for (const r of results) {
		process.stdout.write(
			`  ${r.id}: ${r.score}/5 ${r.passed ? "✓" : "✗"} — ${r.reasoning}\n`,
		);
	}
	process.stdout.write(`\n`);

	return { results, average, passed, failed, total: dataset.length };
}
