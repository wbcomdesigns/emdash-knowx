import type { PluginContext } from "emdash/plugin";

import { spend, type Budget } from "./core";
import { addTotals, ensureStats } from "./stats";
import { asNumber, asRecord, asString, nowIso } from "./util";

/**
 * Stored vote counts, one record per article in `article_votes` (id = article entry id), so a page
 * shows Yes and No in one read and Insights lists the least helpful articles in one query (0.2.0).
 * Vote rows in `feedback` stay the record; this is built from them and then kept in step by every
 * vote, in the same call, with deltas applied in SQL.
 *
 * Fields: `yes`, `no`, `net` (no minus yes: above 0 is a weak article), `title` and `titledAt`
 * (the article's title, refreshed by `tally` at most once a day, so Insights never reads every
 * article). An article gets its record the first time `tally` reads it (the kit does on every
 * article page), or from the upgrade step on Insights for articles voted on before 0.2.0.
 */
export const COUNTERS = "article_votes";

export type Counter = { doc: string; yes: number; no: number; net: number; title: string; titledAt: string };

type Ctx = PluginContext;

export function counterOf(id: string, raw: unknown): Counter | null {
	if (raw === null || raw === undefined) return null;
	const row = asRecord(raw);
	const yes = Math.max(0, asNumber(row.yes) ?? 0);
	const no = Math.max(0, asNumber(row.no) ?? 0);
	return { doc: asString(row.doc) || id, yes, no, net: no - yes, title: asString(row.title), titledAt: asString(row.titledAt) };
}

export async function getCounter(ctx: Ctx, id: string): Promise<Counter | null> {
	return counterOf(id, await ctx.storage[COUNTERS].get(id));
}

export function newCounter(doc: string, yes: number, no: number, title = ""): Counter {
	return { doc, yes, no, net: no - yes, title, titledAt: title ? nowIso() : "" };
}

/**
 * Build an article's record from its vote rows: the article (published only), two counts, a create
 * that only applies when no record exists, then the site totals. At most 7 calls. Returns the
 * counts, or null when the article is not published (nothing stored).
 */
export async function buildCounter(ctx: Ctx, b: Budget, collection: string, id: string): Promise<{ yes: number; no: number } | null> {
	spend(b);
	const item = await ctx.content?.get(collection, id).catch(() => null);
	if (!item || item.status !== "published") return null;
	spend(b, 2);
	const [yes, no] = await Promise.all([
		ctx.storage.feedback.count({ doc_helpful: `${id}:yes` }),
		ctx.storage.feedback.count({ doc_helpful: `${id}:no` }),
	]);
	// ponytail: a vote landing between the counts and the create finds no record to update, so the
	// record misses it (one call wide, once per article, at its first tally). Upgrade path: count
	// again after the create and apply the difference, if a site ever reports it.
	spend(b);
	const title = asString(asRecord(item.data).title) || item.slug || "";
	const made = await ctx.storage[COUNTERS].compareAndSet(id, null, newCounter(id, yes, no, title));
	// Only the call that created the record adds its votes to the site totals. With no votes it makes
	// sure the site record exists, so the votes that follow update their totals in one call.
	if (made.applied) await (yes + no ? addTotals(ctx, b, yes, no) : ensureStats(ctx, b)).catch(() => undefined);
	return { yes, no };
}

/** Yes and No from vote rows, without storing anything (an article that is not published). */
export async function countRows(ctx: Ctx, id: string): Promise<{ yes: number; no: number }> {
	const [yes, no] = await Promise.all([
		ctx.storage.feedback.count({ doc_helpful: `${id}:yes` }),
		ctx.storage.feedback.count({ doc_helpful: `${id}:no` }),
	]);
	return { yes, no };
}

/** How a vote changes the counts, from the visitor's previous vote (null for a first vote). */
export function voteDelta(previous: boolean | null, helpful: boolean): { yes: number; no: number } {
	if (previous === helpful) return { yes: 0, no: 0 };
	if (previous === null) return helpful ? { yes: 1, no: 0 } : { yes: 0, no: 1 };
	return helpful ? { yes: 1, no: -1 } : { yes: -1, no: 1 };
}

/** Apply a vote's change to the article record in one guarded write. Never throws. */
export async function applyDelta(ctx: Ctx, id: string, change: { yes: number; no: number }): Promise<Counter | null> {
	const d: Record<string, { inc: number } | { dec: number }> = {};
	const put = (field: string, n: number) => {
		if (n > 0) d[field] = { inc: n };
		if (n < 0) d[field] = { dec: -n };
	};
	put("yes", change.yes);
	put("no", change.no);
	put("net", change.no - change.yes);
	const done = await ctx.storage[COUNTERS].updateIf(id, { where: {}, delta: d }).catch(() => ({ applied: false as const }));
	return done.applied ? counterOf(id, done.data) : null;
}

/** Rows read past `limit`, so rows skipped for having no title still leave a full list. */
const WEAK_EXTRA = 5;

/**
 * Least helpful articles: more No than Yes, most No first. One query. A row with no stored title
 * takes it from `titles` (a page of published articles the caller read); a row still without one is
 * an article that is no longer published (trashed or unpublished), so it is left out.
 */
export async function weakArticles(ctx: Ctx, limit = 10, titles: Map<string, string> = new Map()): Promise<Counter[]> {
	const found = await ctx.storage[COUNTERS].query({ where: { net: { gt: 0 } }, orderBy: { no: "desc" }, limit: limit + WEAK_EXTRA });
	return found.items
		.map((item) => counterOf(item.id, item.data))
		.filter((row): row is Counter => row !== null)
		.map((row) => (row.title ? row : { ...row, title: titles.get(row.doc) || "" }))
		.filter((row) => row.title)
		.slice(0, limit);
}
