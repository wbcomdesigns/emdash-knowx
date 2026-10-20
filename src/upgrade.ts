import type { PluginContext } from "emdash/plugin";

import { budget, spend, type Budget } from "./core";
import { UPGRADE, type KnowxSettings } from "./settings";
import { addTotals, SITE, STATS, withLegacyDays } from "./stats";
import { asNumber, asRecord, asString, nowIso } from "./util";
import { COUNTERS, counterOf, newCounter } from "./votes";

/**
 * Bringing data over from 0.1.x, one step per Insights load (Cloudflare allows 10 requests per
 * plugin call, so the work cannot run in one go). The state is the kv key STATE, read with its
 * revision. Each step claims its next state with a compare-and-set BEFORE it writes anything, so a
 * step runs once even when two loads race (a double click on Continue, two tabs): the loser shows
 * the progress card. When everything is done the `upgrade_0_2` setting gets `done`, read with the
 * other settings, so later loads spend nothing here.
 *
 * 1. `days`: the 0.1.x day counters (`day:YYYY-MM-DD` keys) are added into the site record, so the
 *    chart keeps the days before the update, then deleted as far as the budget goes.
 * 2. `votes`: vote rows from 0.1.x (rows with no `commented` field; every 0.2.0 vote writes it) are
 *    read 100 at a time in article order. Each article whose rows were all read gets its counts when
 *    it has none yet (one write for all), those votes are added to the site totals, and the comments
 *    of every such article get the `commented` field the Recent comments query uses. An article with
 *    more than 100 votes on one page is left to `tally`, which counts it on its next view.
 * 3. `titles`: the counts made in step 2 get their article's title, read from the published
 *    articles 100 at a time (two pages per load), so Insights and the dashboard name them.
 *
 * Before any step, the first Insights load on 0.2.x looks for 0.1.x data (day counters, vote rows).
 * With none (a new install) it stores `done` and the full page renders in the same load. With some
 * it stores `started` and shows the progress card; from then on every load shows the card until the
 * last step is done, so the page never renders from records that are still being brought over.
 */
export const STATE = "state:upgrade_0_2";

export type Upgrade = { days: boolean; votes: boolean; titles: boolean; after: string; counted: number; titleCursor: string };

export function parseUpgrade(raw: unknown): Upgrade {
	const row = asRecord(raw);
	return {
		days: row.days === true,
		votes: row.votes === true,
		titles: row.titles === true,
		after: asString(row.after),
		counted: asNumber(row.counted) ?? 0,
		titleCursor: asString(row.titleCursor),
	};
}

export const upgradeDone = (state: Upgrade) => state.days && state.votes && state.titles;

/** Done for good: the setting is read with the others, so this costs no call. */
export const upgradeFinished = (settings: KnowxSettings) => settings.upgrade.done === true;

/** A step that found work is shown as progress; one that found none leaves room for the page. */
export type StepResult = { state: Upgrade; used: number; worked: boolean };

/**
 * Run one step. `used` is what the caller spent before it (the settings read). Worst case 9 calls
 * for a step that worked. `worked: false` (render the page) only when the upgrade is done, at 4
 * calls or fewer, leaving the page its five calls; the sixth (titles for 0.1.x comments) is
 * budget-guarded.
 */
export async function upgradeStep(ctx: PluginContext, used: number, settings: KnowxSettings): Promise<StepResult> {
	const b = budget(used);
	if (settings.upgrade.started !== true) return firstLook(ctx, b);
	spend(b);
	const seen = await ctx.kv.getVersioned<Record<string, unknown>>(STATE);
	const state = parseUpgrade(seen?.value);
	const rev = seen?.revision ?? null;
	if (upgradeDone(state)) {
		await finish(ctx, b);
		return { state, used: b.used, worked: false };
	}
	const step = !state.days
		? await daysStep(ctx, b, state, rev)
		: !state.votes
			? await votesStep(ctx, b, state, rev)
			: await titlesStep(ctx, b, state, rev, settings.collection);
	// Until every step is done the records are incomplete: show the card, never the page.
	return { ...step, worked: step.worked || !upgradeDone(step.state) };
}

const NOTHING: Upgrade = { days: true, votes: true, titles: true, after: "", counted: 0, titleCursor: "" };

/** Anything from 0.1.x? Day counters or a vote row with no `commented` (0.2.x votes all write it). */
async function firstLook(ctx: PluginContext, b: Budget): Promise<StepResult> {
	spend(b, 2);
	const [days, votes] = await Promise.all([ctx.kv.list("day:"), ctx.storage.feedback.query({ where: { commented: null }, limit: 1 })]);
	if (!days.length && !votes.items.length) {
		await finish(ctx, b);
		return { state: NOTHING, used: b.used, worked: false };
	}
	spend(b, 2);
	await ctx.settings.set(UPGRADE, { started: true });
	// A site that began on 0.2.0 has its progress here already.
	const seen = await ctx.kv.get<Record<string, unknown>>(STATE);
	return { state: parseUpgrade(seen), used: b.used, worked: true };
}

async function claim(ctx: PluginContext, b: Budget, rev: string | null, next: Upgrade): Promise<boolean> {
	spend(b);
	return (await ctx.kv.compareAndSet(STATE, rev, next)).applied;
}

async function finish(ctx: PluginContext, b: Budget): Promise<void> {
	if (spend(b)) await ctx.settings.set(UPGRADE, { done: true });
}

async function daysStep(ctx: PluginContext, b: Budget, state: Upgrade, rev: string | null): Promise<StepResult> {
	spend(b);
	const legacy = await ctx.kv.list("day:");
	const next = { ...state, days: true };
	if (!(await claim(ctx, b, rev, next))) return { state, used: b.used, worked: true };
	if (!legacy.length) return { state: next, used: b.used, worked: false };
	// Claimed, so the merge runs once. A parallel search can win the site record between the read
	// and the write: read and try once more. ponytail: two lost races in a row drop the 0.1.x day
	// counts from the chart (14 days of searches, nothing else).
	for (let tries = 0; tries < 2 && spend(b, 2); tries += 1) {
		const site = await ctx.storage[STATS].getVersioned(SITE);
		if ((await ctx.storage[STATS].compareAndSet(SITE, site?.revision ?? null, withLegacyDays(site?.value ?? null, legacy))).applied) {
			for (const { key } of legacy) {
				if (!spend(b)) break;
				await ctx.kv.delete(key);
			}
			break;
		}
	}
	return { state: next, used: b.used, worked: true };
}

async function votesStep(ctx: PluginContext, b: Budget, state: Upgrade, rev: string | null): Promise<StepResult> {
	spend(b);
	const page = await ctx.storage.feedback.query({
		where: { commented: null, ...(state.after ? { doc: { gt: state.after } } : {}) },
		orderBy: { doc: "asc" },
		limit: 100,
	});
	if (!page.items.length) {
		// No 0.1.x votes were ever counted here: no count needs a title.
		const next = { ...state, votes: true, titles: state.titles || !state.counted };
		// Finished with nothing left to write: a parallel load writes the same, so no claim.
		if (upgradeDone(next)) await finish(ctx, b);
		else if (!(await claim(ctx, b, rev, next))) return { state, used: b.used, worked: true };
		return { state: next, used: b.used, worked: false };
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
	const rows = complete.flatMap((doc) => byDoc.get(doc)!);
	const next = {
		...state,
		after: page.hasMore && docs.length > 1 ? docs[docs.length - 2]! : docs[docs.length - 1]!,
		votes: !page.hasMore,
		counted: state.counted + rows.length,
	};
	if (!(await claim(ctx, b, rev, next))) return { state, used: b.used, worked: true };
	if (!complete.length) return { state: next, used: b.used, worked: true };
	// ponytail: a first `tally` of one of these articles landing between this read and the write
	// below is overwritten and its votes added to the totals twice (one call wide, once per article).
	spend(b);
	const stored = await ctx.storage[COUNTERS].getMany(complete);
	let yes = 0;
	let no = 0;
	const counters = complete
		.filter((doc) => !stored.has(doc))
		.map((doc) => {
			const votes = byDoc.get(doc)!;
			const y = votes.filter(({ row }) => row.helpful === true).length;
			yes += y;
			no += votes.length - y;
			return { id: doc, data: newCounter(doc, y, votes.length - y) };
		});
	if (counters.length && spend(b)) await ctx.storage[COUNTERS].putMany(counters);
	// Every row here is 0.1.x (no `commented`), also on articles `tally` counted already.
	const comments = rows
		.filter(({ row }) => asString(row.comment))
		.map(({ id, row }) => ({ id, data: { ...row, commented: asString(row.createdAt) || "1970-01-01T00:00:00.000Z" } }));
	if (comments.length && spend(b)) await ctx.storage.feedback.putMany(comments);
	await addTotals(ctx, b, yes, no, true);
	return { state: next, used: b.used, worked: true };
}

/**
 * Name the counts brought over from 0.1.x: up to two pages of published articles, one read of their
 * counts and one write of the ones missing a title. ponytail: the write puts whole count records,
 * so a vote landing between the read and the write of the same page is lost from that article's
 * count (one call wide, once per article per upgrade).
 */
async function titlesStep(ctx: PluginContext, b: Budget, state: Upgrade, rev: string | null, collection: string): Promise<StepResult> {
	const items: Array<{ id: string; slug?: string | null; data: unknown }> = [];
	let cursor = state.titleCursor;
	let end = false;
	for (let pageNo = 0; pageNo < 2 && !end; pageNo += 1) {
		spend(b);
		const page = await ctx.content?.list(collection, { limit: 100, cursor: cursor || undefined, where: { status: "published" } });
		items.push(...(page?.items ?? []));
		if (!page?.hasMore || !page.cursor) end = true;
		else cursor = page.cursor;
	}
	const next = { ...state, titles: end, titleCursor: cursor };
	if (!(await claim(ctx, b, rev, next))) return { state, used: b.used, worked: true };
	if (items.length) {
		spend(b);
		const stored = await ctx.storage[COUNTERS].getMany(items.map((item) => item.id));
		const rows = [];
		for (const item of items) {
			const counter = counterOf(item.id, stored.get(item.id));
			const title = asString(asRecord(item.data).title) || item.slug || "";
			if (counter && !counter.title && title) rows.push({ id: item.id, data: { ...counter, title, titledAt: nowIso() } });
		}
		if (rows.length && spend(b)) await ctx.storage[COUNTERS].putMany(rows);
	}
	if (end) await finish(ctx, b);
	return { state: next, used: b.used, worked: true };
}
