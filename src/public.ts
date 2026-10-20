import type { PluginContext } from "emdash/plugin";

import { articleCollection, budget, BUSY, RATE_LIMITED, rateCheck, spend, type Budget } from "./core";
import { listTopLevelCategories, useProductLayer } from "./products";
import { loadSettings } from "./settings";
import { addTotals, bumpDay } from "./stats";
import { asBoolean, asNumber, asRecord, asString, nowIso } from "./util";
import { normaliseTerm, requestAddress, skipSearchTerm, visitorHash, visitorSalt } from "./visitor";
import { applyDelta, buildCounter, COUNTERS, countRows, getCounter, voteDelta } from "./votes";

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
 *
 * Call budget (Cloudflare, 9): salt 1-2, hourly limit 1-2, the term 1-2, the day counter 1-4, and
 * the trim of a full log 3-4 only when it fits. Every optional step spends from one budget, so no
 * burst, race or full log takes the call past it. The answer never depends on a later write.
 */
export async function handleLogSearch(routeCtx: RouteCtx, ctx: PluginContext, writer: Writer | null) {
	if (!writer) return GUEST_UNAVAILABLE;
	if (bodyTooLarge(routeCtx)) return fail("VALIDATION_ERROR");
	const raw = asRecord(routeCtx.input);
	if (asString(raw.website) || asString(raw.hp)) return { ok: true };
	const term = normaliseTerm(raw.q);
	if (skipSearchTerm(term)) return { ok: true };
	const salt = await visitorSalt(ctx);
	// A parallel first request made the salt at the same moment: this search is not counted.
	if (!salt) return { ok: true };
	const b = budget(salt.fresh ? 2 : 1);
	const who = await visitorHash(salt.salt, writer);
	b.used += salt.fresh ? 1 : 2;
	const rate = await rateCheck(ctx, `search:${who}`, salt.fresh);
	if (rate === "limited") return RATE_LIMITED;
	if (rate === "busy") return { ok: true };
	const empty = asNumber(raw.found) === 0;
	const lastAt = nowIso();
	try {
		spend(b);
		const created = await ctx.storage.searches.compareAndSet(term, null, {
			term,
			count: 1,
			empty: empty ? 1 : 0,
			found: !empty,
			lastAt,
			...(empty ? { lastEmptyAt: lastAt } : {}),
		});
		if (!created.applied && spend(b)) {
			const set: Record<string, unknown> = { lastAt };
			if (empty) Object.assign(set, { found: false, lastEmptyAt: lastAt });
			await ctx.storage.searches.updateIf(term, {
				where: {},
				delta: { count: { inc: 1 }, ...(empty ? { empty: { inc: 1 } } : {}) },
				set,
			});
		}
		await bumpDay(ctx, b, empty);
		if (created.applied) await trimSearchLog(ctx, b);
	} catch {
		/* the search itself is never affected by its log */
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
 * never a term with recent real traffic. Both orders are done by the storage query itself (it
 * returns at most 100 rows and breaks ties by id, so the order must not rely on ties).
 *
 * Runs after a new term is stored, only with the calls left in the budget (3 or 4): the count, one
 * or both queries, the delete. When they do not fit, a later new term trims; each trim removes up
 * to 100 rows, so the log never stays far past the cap.
 */
export async function trimSearchLog(ctx: PluginContext, b: Budget, cap = SEARCH_LOG_CAP): Promise<void> {
	if (!spend(b, 3)) return;
	const total = await ctx.storage.searches.count();
	if (total <= cap) return;
	const excess = Math.min(100, total - cap);
	const since = new Date(Date.now() - EMPTY_WINDOW_MS).toISOString();
	const stale = await ctx.storage.searches.query({ where: { lastAt: { lt: since } }, orderBy: { lastAt: "asc" }, limit: excess });
	const victims = stale.items.map((item) => item.id);
	if (victims.length < excess && spend(b)) {
		const least = await ctx.storage.searches.query({ orderBy: { count: "asc", lastAt: "asc" }, limit: excess - victims.length });
		victims.push(...least.items.map((item) => item.id));
	}
	if (victims.length) await ctx.storage.searches.deleteMany(victims);
}

/**
 * Yes and No for one article: one read of its stored counts. An article read for the first time
 * gets its record from its vote rows (at most 9 calls); one that is not published is counted from
 * its rows and nothing is stored. The title on the record is refreshed at most once a day.
 */
export async function handleTally(routeCtx: RouteCtx, ctx: PluginContext) {
	const id = asString(asRecord(routeCtx.input).id);
	if (!id) return fail("VALIDATION_ERROR");
	const counter = await getCounter(ctx, id);
	if (counter) {
		if (Date.now() - (Date.parse(counter.titledAt) || 0) > TITLE_FRESH_MS) {
			try {
				const item = await ctx.content?.get(await articleCollection(ctx), id);
				const title = asString(asRecord(item?.data).title) || item?.slug || "";
				if (item?.status === "published" && title) {
					await ctx.storage[COUNTERS].updateIf(id, { where: {}, set: { title, titledAt: nowIso() } });
				}
			} catch {
				/* the counts are already read */
			}
		}
		return { ok: true, yes: counter.yes, no: counter.no };
	}
	const b = budget(2);
	const built = await buildCounter(ctx, b, await articleCollection(ctx), id);
	return { ok: true, ...(built ?? (await countRows(ctx, id))) };
}

const TITLE_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * One vote per visitor per article. Call budget (Cloudflare, 9): settings, the article's counts,
 * the salt, the hourly limit (read and compare-and-set), the visitor's previous vote, the vote
 * (compare-and-set, so two clicks at once never count twice), the article's counts and the site
 * totals (deltas in SQL). The answer is ready once the vote is stored: the two count updates after
 * it cannot fail it. An article with no stored counts yet (never read through tally) gets them
 * now and the visitor is asked to click again: nothing of the vote is stored in that call.
 */
export async function handleHelpful(routeCtx: RouteCtx, ctx: PluginContext, writer: Writer | null) {
	if (!writer) return GUEST_UNAVAILABLE;
	const raw = asRecord(routeCtx.input);
	const id = asString(raw.id);
	if (!id) return fail("VALIDATION_ERROR");
	const settings = await loadSettings(ctx);
	const counter = await getCounter(ctx, id);
	if (!counter) {
		const built = await buildCounter(ctx, budget(2), settings.collection, id);
		return built ? BUSY : fail("NOT_FOUND");
	}
	const salt = await visitorSalt(ctx);
	if (!salt) return BUSY;
	const who = await visitorHash(salt.salt, writer);
	const rate = await rateCheck(ctx, `helpful:${who}`, salt.fresh);
	if (rate === "limited") return RATE_LIMITED;
	if (rate === "busy") return BUSY;
	const helpful = asBoolean(raw.helpful);
	let comment = asString(raw.comment).slice(0, 500);
	if (helpful || !settings.askComment) comment = "";
	const rowId = `${id}:${who}`;
	// A new salt means this visitor has no vote yet: skip the read.
	const seen = salt.fresh ? null : await ctx.storage.feedback.getVersioned(rowId);
	const before = seen ? asRecord(seen.value) : null;
	const createdAt = nowIso();
	const written = await ctx.storage.feedback.compareAndSet(rowId, seen?.revision ?? null, {
		doc: id,
		doc_helpful: `${id}:${helpful ? "yes" : "no"}`,
		helpful,
		comment,
		visitor: who,
		createdAt,
		title: counter.title,
		commented: comment ? createdAt : "",
	});
	if (!written.applied) return BUSY;
	const change = voteDelta(before ? before.helpful === true : null, helpful);
	if (!change.yes && !change.no) return { ok: true, yes: counter.yes, no: counter.no };
	const after = await applyDelta(ctx, id, change);
	await addTotals(ctx, budget(8), change.yes, change.no).catch(() => undefined);
	return {
		ok: true,
		yes: after?.yes ?? Math.max(0, counter.yes + change.yes),
		no: after?.no ?? Math.max(0, counter.no + change.no),
	};
}
