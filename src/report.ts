import type { PluginContext } from "emdash/plugin";

import { EMPTY_WINDOW_MS, emptyCount, lastEmptyAt } from "./public";
import { asRecord, asString } from "./util";

type Coll = "searches" | "feedback";
type Query = { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> };
export type StoredRow = { id: string; row: Record<string, unknown> };

/**
 * Every row a query matches, read 100 at a time with the cursor (EmDash returns at most 100 rows
 * per query, whatever the limit says). ponytail: stops at `max` rows; the search log is capped at
 * 5000 terms, and feedback past 5000 votes is read only up to that, newest first.
 */
export async function allRows(ctx: PluginContext, coll: Coll, query: Query, max = 5000): Promise<StoredRow[]> {
	const out: StoredRow[] = [];
	let cursor: string | undefined;
	while (out.length < max) {
		const page = await ctx.storage[coll].query({ ...query, limit: 100, cursor } as never);
		for (const item of page.items) out.push({ id: item.id, row: asRecord(item.data) });
		if (!page.hasMore || !page.cursor) break;
		cursor = page.cursor;
	}
	return out;
}

/**
 * Terms whose last empty search is on or after `since`, most empty searches first. Reads only rows
 * that found nothing, so busy terms can never push an empty one out of the list. A row from 0.1.4
 * has no lastEmptyAt: it counts when its latest search found nothing.
 */
export async function emptySearches(ctx: PluginContext, since = new Date(Date.now() - EMPTY_WINDOW_MS).toISOString()) {
	const rows = new Map<string, StoredRow>();
	for (const item of await allRows(ctx, "searches", { where: { lastEmptyAt: { gte: since } }, orderBy: { lastEmptyAt: "desc" } })) {
		rows.set(item.id, item);
	}
	for (const item of await allRows(ctx, "searches", { where: { found: false, lastAt: { gte: since } }, orderBy: { lastAt: "desc" } })) {
		if (!rows.has(item.id) && lastEmptyAt(item.row) >= since) rows.set(item.id, item);
	}
	return [...rows.values()]
		.map(({ id, row }) => ({ term: asString(row.term) || id, times: emptyCount(row), last: lastEmptyAt(row) }))
		.sort((a, b) => b.times - a.times || b.last.localeCompare(a.last));
}

/** Votes per article and the latest comments, read from every stored vote (up to allRows' cap). */
export async function feedbackSummary(ctx: PluginContext) {
	const byDoc = new Map<string, { yes: number; no: number }>();
	const comments: Array<{ doc: string; comment: string }> = [];
	let yes = 0;
	let no = 0;
	for (const { id, row } of await allRows(ctx, "feedback", { orderBy: { createdAt: "desc" } })) {
		try {
			const doc = asString(row.doc) || id.split(":")[0];
			const bucket = byDoc.get(doc) || { yes: 0, no: 0 };
			if (row.helpful === true) {
				bucket.yes += 1;
				yes += 1;
			} else {
				bucket.no += 1;
				no += 1;
			}
			byDoc.set(doc, bucket);
			const comment = asString(row.comment);
			if (comment && comments.length < 20) comments.push({ doc, comment });
		} catch {
			/* one bad row must not hide the page */
		}
	}
	const weak = [...byDoc.entries()].filter(([, v]) => v.no > v.yes).sort(([, a], [, b]) => b.no - a.no);
	return { yes, no, weak, comments };
}
