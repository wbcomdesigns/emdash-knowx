import type { PluginContext } from "emdash/plugin";

import { spend, type Budget } from "./core";
import { asNumber, asRecord, asString, nowIso } from "./util";

/**
 * One record, `stats/site`, holds the site's running counters so Insights and the dashboard read
 * them in one call (0.2.0):
 *
 * - `yes`, `no`: every helpful vote on the site (the sum of the article counters).
 * - A ring of SLOTS days: `d<i>` is the UTC date the slot holds, `s<i>` its searches, `e<i>` its
 *   searches that found nothing. Day number n (days since 1970) uses slot n % SLOTS.
 * - `since`: when the record was made.
 *
 * Writes are single guarded updates with deltas applied in SQL, so parallel searches and votes
 * never lose a count and never retry in a loop.
 */
export const STATS = "stats";
export const SITE = "site";
export const SLOTS = 16;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const dayNumber = (time: number) => Math.floor(time / DAY_MS);
export const dayDate = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

type Ctx = Pick<PluginContext, "storage">;
type Delta = { inc: number } | { dec: number };

function freshRow(): Record<string, unknown> {
	const row: Record<string, unknown> = { since: nowIso(), yes: 0, no: 0 };
	for (let i = 0; i < SLOTS; i += 1) Object.assign(row, { [`d${i}`]: "", [`s${i}`]: 0, [`e${i}`]: 0 });
	return row;
}

const delta = (n: number): Delta | undefined => (n > 0 ? { inc: n } : n < 0 ? { dec: -n } : undefined);

/**
 * Apply `deltas` to the site record, or create it with `create` applied when it does not exist.
 * At most three calls: the update, a create, and the update again when a parallel call created it.
 * `createFirst` (the record may well be missing) tries the create first: at most two calls, since
 * the record is never deleted and the update that follows a lost create always applies.
 */
async function bump(ctx: Ctx, b: Budget, deltas: Record<string, Delta>, create: (row: Record<string, unknown>) => void, createFirst = false) {
	if (createFirst) {
		if (!spend(b)) return;
		const row = freshRow();
		create(row);
		if ((await ctx.storage[STATS].compareAndSet(SITE, null, row)).applied) return;
		if (!spend(b)) return;
		await ctx.storage[STATS].updateIf(SITE, { where: {}, delta: deltas });
		return;
	}
	if (!spend(b)) return;
	if ((await ctx.storage[STATS].updateIf(SITE, { where: {}, delta: deltas })).applied) return;
	if (!spend(b)) return;
	const row = freshRow();
	create(row);
	if ((await ctx.storage[STATS].compareAndSet(SITE, null, row)).applied) return;
	if (!spend(b)) return;
	await ctx.storage[STATS].updateIf(SITE, { where: {}, delta: deltas });
}

/** Make the site record when there is none yet (one call), so later votes find their totals. */
export async function ensureStats(ctx: Ctx, b: Budget): Promise<void> {
	if (!spend(b)) return;
	await ctx.storage[STATS].compareAndSet(SITE, null, freshRow());
}

/** Add votes to the site totals (negative numbers take them away). */
export async function addTotals(ctx: Ctx, b: Budget, yes: number, no: number, createFirst = false): Promise<void> {
	const deltas: Record<string, Delta> = {};
	if (delta(yes)) deltas.yes = delta(yes)!;
	if (delta(no)) deltas.no = delta(no)!;
	if (!Object.keys(deltas).length) return;
	await bump(ctx, b, deltas, (row) => Object.assign(row, { yes: Math.max(0, yes), no: Math.max(0, no) }), createFirst);
}

/**
 * Count one search in today's slot. Usually one call. The first search of a day takes the slot
 * over from the day SLOTS days ago (one more); a site with no record yet creates it. Every step
 * spends from the caller's budget, so a burst never passes it.
 */
export async function bumpDay(ctx: Ctx, b: Budget, empty: boolean, now = Date.now()): Promise<void> {
	const n = dayNumber(now);
	const i = n % SLOTS;
	const date = dayDate(n);
	const counts: Record<string, Delta> = { [`s${i}`]: { inc: 1 }, ...(empty ? { [`e${i}`]: { inc: 1 } } : {}) };
	const today = { [`d${i}`]: date };
	if (!spend(b)) return;
	if ((await ctx.storage[STATS].updateIf(SITE, { where: today, delta: counts })).applied) return;
	// The slot still holds an older day: start it again for today.
	if (!spend(b)) return;
	const restart = { [`d${i}`]: date, [`s${i}`]: 1, [`e${i}`]: empty ? 1 : 0 };
	if ((await ctx.storage[STATS].updateIf(SITE, { where: { [`d${i}`]: { lt: date } }, set: restart })).applied) return;
	// No record yet (create it), or a parallel search restarted the slot just now (count again).
	if (!spend(b)) return;
	if ((await ctx.storage[STATS].compareAndSet(SITE, null, { ...freshRow(), ...restart })).applied) return;
	if (!spend(b)) return;
	await ctx.storage[STATS].updateIf(SITE, { where: today, delta: counts });
}

export type SiteStats = {
	exists: boolean;
	yes: number;
	no: number;
	/** Searches and empty searches per UTC day, oldest first, `days` long, ending today. */
	days: Array<{ day: number; searches: number; empty: number }>;
};

/** Read the site record in one call. A missing record reads as all zeros. */
export async function readStats(ctx: Ctx, days = 14, now = Date.now()): Promise<SiteStats> {
	const raw = await ctx.storage[STATS].get(SITE);
	return statsOf(raw, days, now);
}

export function statsOf(raw: unknown, days = 14, now = Date.now()): SiteStats {
	const row = asRecord(raw);
	const today = dayNumber(now);
	const out: SiteStats["days"] = [];
	for (let n = today - days + 1; n <= today; n += 1) {
		const i = n % SLOTS;
		const held = asString(row[`d${i}`]) === dayDate(n);
		out.push({
			day: n * DAY_MS,
			searches: held ? Math.max(0, asNumber(row[`s${i}`]) ?? 0) : 0,
			empty: held ? Math.max(0, asNumber(row[`e${i}`]) ?? 0) : 0,
		});
	}
	return {
		exists: raw !== null && raw !== undefined,
		yes: Math.max(0, asNumber(row.yes) ?? 0),
		no: Math.max(0, asNumber(row.no) ?? 0),
		days: out,
	};
}

/**
 * The site record with 0.1.x day counters (`day:YYYY-MM-DD` keys, `searches|empty`) added in:
 * a slot holding the same day adds them, a slot holding an older day takes the day over. Days
 * older than the ring are dropped. Pure; the upgrade stores it with compare-and-set.
 */
export function withLegacyDays(raw: unknown, legacy: Array<{ key: string; value: unknown }>, now = Date.now()): Record<string, unknown> {
	const row = raw ? { ...asRecord(raw) } : freshRow();
	const today = dayNumber(now);
	for (const { key, value } of legacy) {
		const date = key.slice("day:".length);
		const time = Date.parse(`${date}T00:00:00.000Z`);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(time)) continue;
		const n = dayNumber(time);
		if (n > today || n <= today - SLOTS) continue;
		const [searches, empty] = asString(value).split("|").map(Number);
		const i = n % SLOTS;
		const held = asString(row[`d${i}`]);
		if (held > date) continue;
		const same = held === date;
		row[`d${i}`] = date;
		row[`s${i}`] = (same ? asNumber(row[`s${i}`]) ?? 0 : 0) + (searches || 0);
		row[`e${i}`] = (same ? asNumber(row[`e${i}`]) ?? 0 : 0) + (empty || 0);
	}
	return row;
}
