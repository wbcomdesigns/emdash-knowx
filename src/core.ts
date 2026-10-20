import type { PluginContext } from "emdash/plugin";

import { asRecord, asString } from "./util";

export const DOCS = "docs";
export const FAQ = "faq";
export const DOC_CATEGORY = "doc_category";

/**
 * Bridge calls one plugin call may make. On Cloudflare each route, hook and admin action gets 10
 * requests to the site, and every ctx.storage, ctx.kv, ctx.settings, ctx.content, ctx.schema and
 * ctx.taxonomies call is one. One under the limit, for headroom (tests/bridge-budget.test.ts).
 */
export const MAX_CALLS = 9;

/** Calls made so far in this plugin call. Paths with optional work spend from it and stop when empty. */
export type Budget = { used: number };

export const budget = (used = 0): Budget => ({ used });

/** Take `n` calls from the budget. False, and nothing taken, when they would pass MAX_CALLS. */
export function spend(b: Budget, n = 1): boolean {
	if (b.used + n > MAX_CALLS) return false;
	b.used += n;
	return true;
}

export async function articleCollection(ctx: PluginContext): Promise<string> {
	return asString(await ctx.settings.get<string>("collection")) || DOCS;
}

/** Articles counted on one page of the content list. More than this shows as "100+". */
export const COUNT_PAGE = 100;

export type CollectionStatus = {
	collection: string;
	collectionExists: boolean;
	/** Published articles, counted up to COUNT_PAGE. */
	articleCount: number;
	/** True when there are more than COUNT_PAGE published articles. */
	articleMore: boolean;
	faqCollectionExists: boolean;
	/** Names the owner sees under Content in the admin menu. */
	articleLabel: string;
	faqLabel: string;
	/** Titles of the newest published articles, by entry id (the page that was counted). */
	titles: Map<string, string>;
};

/**
 * Whether the article and FAQ content types exist, and how many articles are published. Two calls:
 * the content types, then one page of published articles. EmDash has no count for content, and
 * paging every article cost one call per hundred (12 on a site of 1000, over the Cloudflare limit),
 * so the count stops at COUNT_PAGE and says "more".
 */
export async function collectionStatus(ctx: PluginContext, collection: string): Promise<CollectionStatus> {
	const collections = (await ctx.schema?.listCollections()) ?? [];
	const label = (slug: string, fallback: string) => collections.find((item) => item.slug === slug)?.label || fallback;
	const slugs = new Set(collections.map((item) => item.slug));
	const collectionExists = slugs.has(collection);
	const titles = new Map<string, string>();
	let articleCount = 0;
	let articleMore = false;
	if (collectionExists && ctx.content?.list) {
		const page = await ctx.content
			.list(collection, { limit: COUNT_PAGE, where: { status: "published" } })
			.catch(() => null);
		for (const item of page?.items ?? []) titles.set(item.id, asString(asRecord(item.data).title) || item.slug || "");
		articleCount = page?.items.length ?? 0;
		articleMore = Boolean(page?.hasMore);
	}
	return {
		collection,
		collectionExists,
		articleCount,
		articleMore,
		faqCollectionExists: slugs.has(FAQ),
		articleLabel: label(collection, "Help articles"),
		faqLabel: label(FAQ, "FAQs"),
		titles,
	};
}

// Lowest signed-in role (subscriber). Private routes get a host-verified routeCtx.user.
// A public route never gets a user, and a member id in the request is never trusted.
export const MEMBER = "content:read";

export type Member = { id: string; name: string | null; role: number };

export const SIGN_IN = { ok: false, error: { code: "SIGN_IN_REQUIRED", message: "Sign in to continue." } };
export const RATE_LIMITED = {
	ok: false,
	error: { code: "RATE_LIMITED", message: "Too many requests. Try again in an hour." },
};
/**
 * Another request from the same visitor changed the same thing at the same moment. The code is one
 * every kit already shows as "Your vote could not be saved. Try again."; nothing was stored.
 */
export const BUSY = { ok: false, error: { code: "VALIDATION_ERROR", reason: "BUSY", message: "Try again." } };

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;

/**
 * Count one write toward the visitor's hourly limit: one read and one compare-and-set, never a
 * retry loop, so contention cannot pass the call budget. "busy" means another request of the same
 * visitor won the race; the caller stores nothing. `fresh` is true when the visitor key was made
 * with a salt created in this call: no record can exist yet, so the read is skipped.
 */
export async function rateCheck(ctx: PluginContext, who: string, fresh = false): Promise<"ok" | "limited" | "busy"> {
	const key = `rate:${who}`;
	const seen = fresh ? null : await ctx.kv.getVersioned<string>(key);
	const [start, count] = (seen?.value || "0|0").split("|").map(Number);
	const now = Date.now();
	const restart = now - (start || 0) > RATE_WINDOW_MS;
	if (!restart && (count || 0) >= RATE_MAX) return "limited";
	const next = restart ? `${now}|1` : `${start}|${(count || 0) + 1}`;
	return (await ctx.kv.compareAndSet(key, seen?.revision ?? null, next)).applied ? "ok" : "busy";
}
