import type { Db } from "../db";

export interface CostEventRow {
	id: string;
	kind: string;
	model: string;
	input_tokens: number;
	output_tokens: number;
	characters: number;
	cost_usd: number;
	turn_id: string | null;
	created_at: number;
}

export interface InsertCostEventInput {
	id: string;
	kind: "chat" | "tts" | "tts_hd" | "embedding" | "image";
	model: string;
	inputTokens?: number;
	outputTokens?: number;
	characters?: number;
	costUsd?: number;
	turnId?: string | null;
}

export function insertCostEvent(db: Db, input: InsertCostEventInput): void {
	db.prepare(`
    INSERT INTO cost_events
      (id, kind, model, input_tokens, output_tokens, characters, cost_usd, turn_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
		input.id,
		input.kind,
		input.model,
		input.inputTokens ?? 0,
		input.outputTokens ?? 0,
		input.characters ?? 0,
		input.costUsd ?? 0,
		input.turnId ?? null,
		Date.now(),
	);
}

export interface DailySummary {
	date: string;
	totalCostUsd: number;
	totalInputTokens: number;
	totalOutputTokens: number;
}

export function getDailySummary(db: Db, days = 7): DailySummary[] {
	const rows = db
		.prepare(`
    SELECT
      DATE(created_at / 1000, 'unixepoch') AS date,
      SUM(cost_usd)      AS totalCostUsd,
      SUM(input_tokens)  AS totalInputTokens,
      SUM(output_tokens) AS totalOutputTokens
    FROM cost_events
    WHERE created_at >= ?
    GROUP BY date
    ORDER BY date DESC
    LIMIT ?
  `)
		.all(Date.now() - days * 86_400_000, days) as DailySummary[];
	return rows;
}
