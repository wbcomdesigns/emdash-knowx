import type { PluginContext } from "emdash/plugin";

import { EMPTY_WINDOW_MS, emptyCount, lastEmptyAt } from "./public";
import { asString } from "./util";

/** Rows the Searches with no results table shows. */
export const EMPTY_SHOWN = 50;

/**
 * Terms that found nothing in the last EMPTY_WINDOW_MS, most empty searches first, at most
 * EMPTY_SHOWN. Two queries, whatever the size of the log: rows that record their empty searches
 * (0.1.5 and later), and rows from 0.1.4, which only say their latest search found nothing.
 */
export async function emptySearches(ctx: PluginContext, since = new Date(Date.now() - EMPTY_WINDOW_MS).toISOString()) {
	const rows = new Map<string, Record<string, unknown>>();
	const counted = await ctx.storage.searches.query({ where: { lastEmptyAt: { gte: since } }, orderBy: { empty: "desc" }, limit: EMPTY_SHOWN });
	for (const item of counted.items) rows.set(item.id, item.data as Record<string, unknown>);
	const older = await ctx.storage.searches.query({ where: { found: false, lastAt: { gte: since } }, orderBy: { count: "desc" }, limit: EMPTY_SHOWN });
	for (const item of older.items) {
		const row = item.data as Record<string, unknown>;
		if (!rows.has(item.id) && lastEmptyAt(row) >= since) rows.set(item.id, row);
	}
	return [...rows]
		.map(([id, row]) => ({ term: asString(row.term) || id, times: emptyCount(row), last: lastEmptyAt(row) }))
		.sort((a, b) => b.times - a.times || b.last.localeCompare(a.last))
		.slice(0, EMPTY_SHOWN);
}

/** The newest comments left after a No vote, newest first. One query. */
export async function recentComments(ctx: PluginContext, limit = 20) {
	const found = await ctx.storage.feedback.query({ where: { commented: { gt: "" } }, orderBy: { commented: "desc" }, limit });
	return found.items
		.map((item) => {
			const row = item.data as Record<string, unknown>;
			return { doc: asString(row.doc) || item.id.split(":")[0]!, comment: asString(row.comment), title: asString(row.title) };
		})
		.filter((row) => row.comment);
}
