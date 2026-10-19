import type { PluginContext } from "emdash/plugin";

import { articleCollection, RATE_LIMITED, rateLimited } from "./core";
import { listTopLevelCategories, useProductLayer } from "./products";
import { loadSettings } from "./settings";
import { asBoolean, asNumber, asRecord, asString, nowIso } from "./util";
import { normaliseTerm, requestAddress, skipSearchTerm, visitorHash } from "./visitor";

type RouteCtx = { input: unknown; requestMeta?: unknown; user?: unknown; request?: unknown };

function fail(code: string) {
	return { ok: false, error: { code } };
}

export async function handleConfig(ctx: PluginContext) {
	const settings = await loadSettings(ctx);
	return {
		ok: true,
		searchCollections: settings.searchCollections,
		contactUrl: settings.contactUrl,
		askComment: settings.askComment,
	};
}

export async function handleProducts(ctx: PluginContext) {
	const items = await listTopLevelCategories(ctx);
	return {
		ok: true,
		productLayer: useProductLayer(items),
		items: items.map(({ slug, label, description, icon }) => ({ slug, label, description, icon })),
	};
}

/** Rows the search log keeps. The oldest searched terms go first when a new term would pass it. */
export const SEARCH_LOG_CAP = 5000;
/** How long a search with no results stays on the "Searches with no results" list. */
export const EMPTY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A guest write on a host that gives no usable visitor address. The code is one the 0.1.4 kit
 * already turns into its vote message ("Your vote could not be saved"), so a site that updated
 * the plugin before copying the new kit never shows a generic error; the 0.1.4 kit has no sign-in
 * wording to reach. The 0.1.5 kit reads `reason` and shows the sign-in line.
 */
export const GUEST_UNAVAILABLE = {
	ok: false,
	error: { code: "VALIDATION_ERROR", reason: "GUEST_UNAVAILABLE", message: "Sign in to continue." },
};

/** Who is writing: a member (host-verified id) or a guest counted by the address EmDash gave. */
export type Writer = { address: string } | { member: string };

/** The guest writer for this request, or null when the host gave no visitor address (#40). */
export function guestWriter(routeCtx: RouteCtx): Writer | null {
	const address = requestAddress(routeCtx);
	return address ? { address } : null;
}

export function memberWriter(routeCtx: RouteCtx): Writer | null {
	const id = asString((routeCtx.user as { id?: unknown } | undefined)?.id);
	return id ? { member: id } : null;
}

/** A search log body is a few short fields. Anything bigger is refused before it is read. */
const LOG_BODY_MAX = 2048;

function bodyTooLarge(routeCtx: RouteCtx): boolean {
	const headers = (routeCtx.request as { headers?: { get?: (name: string) => string | null } } | undefined)?.headers;
	const length = Number(headers?.get?.("content-length") ?? 0);
	if (length > LOG_BODY_MAX) return true;
	try {
		return JSON.stringify(routeCtx.input ?? null).length > LOG_BODY_MAX;
	} catch {
		return true;
	}
}

/**
 * Count one help search. The plugin cannot run search itself (sandboxed plugins have no search
 * API), so it never trusts a caller who says a search found results: a report of "nothing found"
 * is counted on its own and a later call can never clear it. Anyone could add an empty term by
 * searching for it, so a forged report gains nothing; hiding a real empty search is no longer
 * possible. Empty searches drop off the list after EMPTY_WINDOW_MS.
 */
export async function handleLogSearch(routeCtx: RouteCtx, ctx: PluginContext, writer: Writer | null) {
	if (!writer) return GUEST_UNAVAILABLE;
	if (bodyTooLarge(routeCtx)) return fail("VALIDATION_ERROR");
	const raw = asRecord(routeCtx.input);
	if (asString(raw.website) || asString(raw.hp)) return { ok: true };
	const who = await visitorHash(ctx, writer);
	if (await rateLimited(ctx, `search:${who}`)) return RATE_LIMITED;
	const term = normaliseTerm(raw.q);
	if (skipSearchTerm(term)) return { ok: true };
	const empty = asNumber(raw.found) === 0;
	await bumpDay(ctx, empty);
	const lastAt = nowIso();
	const existing = asRecord(await ctx.storage.searches.get(term));
	if (!existing.term) {
		await ctx.storage.searches.put(term, {
			term,
			count: 1,
			empty: empty ? 1 : 0,
			found: !empty,
			lastAt,
			...(empty ? { lastEmptyAt: lastAt } : {}),
		});
		await trimSearchLog(ctx);
		return { ok: true };
	}
	const set: Record<string, unknown> = { lastAt };
	if (empty) Object.assign(set, { found: false, lastEmptyAt: lastAt });
	const updated = await ctx.storage.searches.updateIf(term, {
		where: {},
		delta: { count: { inc: 1 }, ...(empty ? { empty: { inc: 1 } } : {}) },
		set,
	});
	if (!updated.applied) {
		await ctx.storage.searches.put(term, {
			...existing,
			term,
			count: (asNumber(existing.count) ?? 0) + 1,
			empty: emptyCount(existing) + (empty ? 1 : 0),
			...set,
		});
	}
	return { ok: true };
}

/** Searches of a row that found nothing. A 0.1.4 row only has found: false and its count. */
export function emptyCount(row: Record<string, unknown>): number {
	const counted = asNumber(row.empty);
	if (counted !== null) return counted;
	return row.found === false ? (asNumber(row.count) ?? 0) : 0;
}

/** When the term last found nothing, or "" when it never did. */
export function lastEmptyAt(row: Record<string, unknown>): string {
	return asString(row.lastEmptyAt) || (row.found === false ? asString(row.lastAt) : "");
}

/**
 * Keep the log at SEARCH_LOG_CAP rows. First go terms nobody searched in the last EMPTY_WINDOW_MS,
 * oldest first, so old busy terms cannot hold the log for good. Then the least searched terms, the
 * oldest of them first, so a flood of made-up one-off terms only pushes out other one-off terms and
 * never a term with recent real traffic. Both orders are done by the storage query itself
 * (it returns at most 100 rows and breaks ties by id, so the order must not rely on ties).
 */
export async function trimSearchLog(ctx: PluginContext, cap = SEARCH_LOG_CAP): Promise<void> {
	const total = await ctx.storage.searches.count();
	if (total <= cap) return;
	const excess = Math.min(100, total - cap);
	const since = new Date(Date.now() - EMPTY_WINDOW_MS).toISOString();
	const stale = await ctx.storage.searches.query({ where: { lastAt: { lt: since } }, orderBy: { lastAt: "asc" }, limit: excess });
	const victims = stale.items.map((item) => item.id);
	if (victims.length < excess) {
		const least = await ctx.storage.searches.query({ orderBy: { count: "asc", lastAt: "asc" }, limit: excess - victims.length });
		victims.push(...least.items.map((item) => item.id));
	}
	await ctx.storage.searches.deleteMany(victims);
}

/** UTC day key for the running search counters. */
export function dayKey(date: Date): string {
	return `day:${date.toISOString().slice(0, 10)}`;
}

/**
 * One running counter per day (searches, and searches that found nothing), kept in kv and
 * updated on each logged search, so Insights totals never depend on how many terms a query reads.
 */
// ponytail: compare-and-set with random backoff, at most DAY_TRIES tries. Proven with 40 parallel
// writers (tests). Past that a burst can drop a count from the week total, never a search row;
// per-writer shard keys summed on read would remove the ceiling.
const DAY_TRIES = 60;

async function bumpDay(ctx: PluginContext, empty: boolean): Promise<void> {
	const key = dayKey(new Date());
	for (let attempt = 0; attempt < DAY_TRIES; attempt += 1) {
		const seen = await ctx.kv.getVersioned<string>(key);
		const [searches, none] = (seen?.value || "0|0").split("|").map(Number);
		const next = `${(searches || 0) + 1}|${(none || 0) + (empty ? 1 : 0)}`;
		if ((await ctx.kv.compareAndSet(key, seen?.revision ?? null, next)).applied) return;
		await new Promise((resolve) => setTimeout(resolve, Math.random() * Math.min(5 + attempt * 5, 50)));
	}
}

/** Searches and empty searches per UTC day for the last `days` days, oldest first. */
export async function dayTotals(ctx: PluginContext, days: number): Promise<Array<{ day: number; searches: number; empty: number }>> {
	const out = [];
	for (let i = days - 1; i >= 0; i -= 1) {
		const date = new Date();
		date.setUTCHours(0, 0, 0, 0);
		date.setUTCDate(date.getUTCDate() - i);
		const [searches, empty] = (asString(await ctx.kv.get<string>(dayKey(date))) || "0|0").split("|").map(Number);
		out.push({ day: date.getTime(), searches: searches || 0, empty: empty || 0 });
	}
	return out;
}

export async function handleTally(routeCtx: RouteCtx, ctx: PluginContext) {
	const id = asString(asRecord(routeCtx.input).id);
	if (!id) return fail("VALIDATION_ERROR");
	const [yes, no] = await Promise.all([
		ctx.storage.feedback.count({ doc_helpful: `${id}:yes` }),
		ctx.storage.feedback.count({ doc_helpful: `${id}:no` }),
	]);
	return { ok: true, yes, no };
}

export async function handleHelpful(routeCtx: RouteCtx, ctx: PluginContext, writer: Writer | null) {
	if (!writer) return GUEST_UNAVAILABLE;
	const raw = asRecord(routeCtx.input);
	const id = asString(raw.id);
	if (!id) return fail("VALIDATION_ERROR");
	const collection = await articleCollection(ctx);
	const entry = await ctx.content?.get(collection, id).catch(() => null);
	if (!entry || entry.status !== "published") return fail("NOT_FOUND");
	const who = await visitorHash(ctx, writer);
	if (await rateLimited(ctx, `helpful:${who}`)) return RATE_LIMITED;
	const helpful = asBoolean(raw.helpful);
	const settings = await loadSettings(ctx);
	let comment = asString(raw.comment).slice(0, 500);
	if (helpful || !settings.askComment) comment = "";
	const rowId = `${id}:${who}`;
	await ctx.storage.feedback.put(rowId, {
		doc: id,
		doc_helpful: `${id}:${helpful ? "yes" : "no"}`,
		helpful,
		comment,
		visitor: who,
		createdAt: nowIso(),
	});
	return handleTally({ input: { id } }, ctx);
}
