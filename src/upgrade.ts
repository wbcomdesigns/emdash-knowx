import type { PluginContext } from "emdash/plugin";

import { budget, MAX_CALLS, spend, type Budget } from "./core";
import { UPGRADE, type KnowxSettings } from "./settings";
import { addTotals, SITE, STATS, withLegacyDays } from "./stats";
import { asNumber, asRecord, asString, nowIso } from "./util";
import { COUNTERS, counterOf, newCounter } from "./votes";

/**
 * Bringing data over from 0.1.x, one step per Insights load (Cloudflare allows 10 requests per
 * plugin call, so the work cannot run in one go). State is the `upgrade_0_2` setting:
 *
 * 1. `days`: the 0.1.x day counters (`day:YYYY-MM-DD` keys) are added into the site record, so the
 *    chart keeps the days before the update. One list, one read, one compare-and-set.
 * 2. `votes`: vote rows from 0.1.x (rows with no `commented` field; every 0.2.0 vote writes it) are
 *    read 100 at a time in article order. Each article whose rows were all read and that has no
 *    stored counts yet gets them (one write for all), its votes are added to the site totals, and
 *    its comments get the `commented` field the Recent comments query uses. An article with more
 *    than 100 votes on one page is left to `tally`, which counts it on its next view.
 * 3. `titles`: the counts made in step 2 get their article's title, read from the published
 *    articles 100 at a time (two pages per load), so Insights and the dashboard name them.
 *
 * Votes cast after the update need no step: `tally` builds an article's counts the first time it is
 * read, and every vote keeps them in step. A site with nothing to bring over (a new install) spends
 * two reads per Insights load until it has 0.1.x data, which it never will; nothing is stored.
 */
export type Upgrade = { days: boolean; votes: boolean; titles: boolean; after: string; counted: number; titleCursor: string };

export function upgradeState(settings: KnowxSettings): Upgrade {
	const raw = settings.upgrade;
	return {
		days: raw.days === true,
		votes: raw.votes === true,
		titles: raw.titles === true,
		after: asString(raw.after),
		counted: asNumber(raw.counted) ?? 0,
		titleCursor: asString(raw.titleCursor),
	};
}

export const upgradeDone = (state: Upgrade) => state.days && state.votes && state.titles;

/** A step that found work is shown as progress; one that found none leaves room for the full page. */
export type StepResult = { state: Upgrade; used: number; worked: boolean };

/**
 * Run one step. `used` is what the caller spent before it (the settings read); `room` is what the
 * caller needs after a step that found no work (the Insights page). Worst case 8 calls.
 */
export async function upgradeStep(
	ctx: PluginContext,
	state: Upgrade,
	used: number,
	room: number,
	collection: string,
): Promise<StepResult> {
	const b = budget(used);
	const next = { ...state };
	if (!next.days) {
		spend(b);
		const legacy = await ctx.kv.list("day:");
		next.days = true;
		if (legacy.length) {
			spend(b, 2);
			const seen = await ctx.storage[STATS].getVersioned(SITE);
			const merged = withLegacyDays(seen?.value ?? null, legacy);
			// Lost to a parallel search: the next load tries again.
			if (!(await ctx.storage[STATS].compareAndSet(SITE, seen?.revision ?? null, merged)).applied) return { state, used: b.used, worked: true };
			return save(ctx, b, next, true);
		}
	}
	if (next.votes) return next.titles ? { state, used: b.used, worked: false } : titlesStep(ctx, b, next, collection);
	spend(b);
	const page = await ctx.storage.feedback.query({
		where: { commented: null, ...(next.after ? { doc: { gt: next.after } } : {}) },
		orderBy: { doc: "asc" },
		limit: 100,
	});
	if (!page.items.length) {
		next.votes = true;
		// No 0.1.x votes were ever counted here: no count needs a title.
		if (!next.counted) next.titles = true;
		// Nothing to bring over. Store that only when it still leaves room for the page.
		if (b.used + 1 + room <= MAX_CALLS) return save(ctx, b, next, false);
		return { state, used: b.used, worked: false };
	}
	const byDoc = new Map<string, Array<{ id: string; row: Record<string, unknown> }>>();
	for (const item of page.items) {
		const row = asRecord(item.data);
		const doc = asString(row.doc) || item.id.split(":")[0]!;
		byDoc.set(doc, [...(byDoc.get(doc) ?? []), { id: item.id, row }]);
	}
	const docs = [...byDoc.keys()];
	// With more rows to read, the last article may go on in the next page: count it next time.
	// A page that is all one article (over 100 votes) is left to tally.
	const complete = page.hasMore && docs.length > 1 ? docs.slice(0, -1) : page.hasMore ? [] : docs;
	// Counting takes up to 7 more calls (read, write, totals 3, comments, save). When they do not fit
	// (the days step ran first), this load stores what it did; the next one counts.
	if (complete.length && b.used + 7 > MAX_CALLS) return save(ctx, b, { ...next, votes: false }, true);
	next.after = page.hasMore && docs.length > 1 ? docs[docs.length - 2]! : docs[docs.length - 1]!;
	next.votes = !page.hasMore;
	if (complete.length) {
		spend(b);
		const stored = await ctx.storage[COUNTERS].getMany(complete);
		const missing = complete.filter((doc) => !stored.has(doc));
		let yes = 0;
		let no = 0;
		const counters = missing.map((doc) => {
			const rows = byDoc.get(doc)!;
			const y = rows.filter(({ row }) => row.helpful === true).length;
			yes += y;
			no += rows.length - y;
			return { id: doc, data: newCounter(doc, y, rows.length - y) };
		});
		if (counters.length) {
			spend(b);
			await ctx.storage[COUNTERS].putMany(counters);
			// One call is kept for the save.
			b.used += 1;
			await addTotals(ctx, b, yes, no);
			b.used -= 1;
			// Only articles counted here: none has a 0.2.0 vote, which needs stored counts.
			const comments = missing
				.flatMap((doc) => byDoc.get(doc)!)
				.filter(({ row }) => asString(row.comment))
				.map(({ id, row }) => ({ id, data: { ...row, commented: asString(row.createdAt) || "1970-01-01T00:00:00.000Z" } }));
			if (comments.length && b.used + 2 <= MAX_CALLS) {
				spend(b);
				await ctx.storage.feedback.putMany(comments);
			}
		}
		next.counted = state.counted + yes + no;
	}
	return save(ctx, b, next, true);
}

/**
 * Name the counts brought over from 0.1.x: up to two pages of published articles, each one list,
 * one read of their counts and one write of the ones missing a title. ponytail: the write puts
 * whole count records, so a vote landing between the read and the write of the same page is lost
 * from that article's count (one call wide, once per article per upgrade).
 */
async function titlesStep(ctx: PluginContext, b: Budget, next: Upgrade, collection: string): Promise<StepResult> {
	for (let pageNo = 0; pageNo < 2 && b.used + 4 <= MAX_CALLS; pageNo += 1) {
		spend(b);
		const page = await ctx.content?.list(collection, { limit: 100, cursor: next.titleCursor || undefined, where: { status: "published" } });
		const items = page?.items ?? [];
		if (items.length) {
			spend(b);
			const stored = await ctx.storage[COUNTERS].getMany(items.map((item) => item.id));
			const rows = [];
			for (const item of items) {
				const counter = counterOf(item.id, stored.get(item.id));
				const title = asString(asRecord(item.data).title) || item.slug || "";
				if (counter && !counter.title && title) rows.push({ id: item.id, data: { ...counter, title, titledAt: nowIso() } });
			}
			if (rows.length) {
				spend(b);
				await ctx.storage[COUNTERS].putMany(rows);
			}
		}
		if (!page?.hasMore || !page.cursor) {
			next.titles = true;
			break;
		}
		next.titleCursor = page.cursor;
	}
	return save(ctx, b, next, true);
}

async function save(ctx: PluginContext, b: Budget, next: Upgrade, worked: boolean): Promise<StepResult> {
	spend(b);
	await ctx.settings.set(UPGRADE, next);
	return { state: next, used: b.used, worked };
}
