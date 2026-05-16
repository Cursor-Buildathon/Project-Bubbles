import type { Db, InsertCostEventInput } from "@bubbles/memory-core";
import {
	getDailySummary as dbGetDailySummary,
	insertCostEvent as dbInsertCostEvent,
} from "@bubbles/memory-core";

export type { DailySummary, InsertCostEventInput } from "@bubbles/memory-core";

/**
 * Record a cost event into the DB (Foundation Enabler #5).
 * Called by minimax-client / agent-runtime after every model call.
 */
export function recordCostEvent(db: Db, input: InsertCostEventInput): void {
	dbInsertCostEvent(db, input);
}

/**
 * Summarise cost for the last `days` days (for Settings spend view).
 */
export function getDailySummary(db: Db, days = 7) {
	return dbGetDailySummary(db, days);
}
