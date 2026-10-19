import type { PluginContext } from "emdash/plugin";

import { asRecord, asString } from "./util";

export const DOCS = "docs";
export const FAQ = "faq";
export const DOC_CATEGORY = "doc_category";

export async function articleCollection(ctx: PluginContext): Promise<string> {
	return asString(await ctx.settings.get<string>("collection")) || DOCS;
}

export async function publishedCount(ctx: PluginContext, collection: string): Promise<number> {
	if (!ctx.content?.list) return 0;
	let count = 0;
	let cursor: string | undefined;
	for (let page = 0; page < 20; page++) {
		const result = await ctx.content
			.list(collection, { limit: 100, cursor, where: { status: "published" } })
			.catch(() => null);
		if (!result) break;
		count += result.items.length;
		if (!result.hasMore || !result.cursor) break;
		cursor = result.cursor;
	}
	return count;
}

export async function collectionStatus(ctx: PluginContext): Promise<{
	collection: string;
	collectionExists: boolean;
	articleCount: number;
	faqCollectionExists: boolean;
	/** Names the owner sees under Content in the admin menu. */
	articleLabel: string;
	faqLabel: string;
}> {
	const collection = await articleCollection(ctx);
	const collections = (await ctx.schema?.listCollections()) ?? [];
	const label = (slug: string, fallback: string) => collections.find((item) => item.slug === slug)?.label || fallback;
	const slugs = new Set(collections.map((item) => item.slug));
	const collectionExists = slugs.has(collection);
	return {
		collection,
		collectionExists,
		articleCount: collectionExists ? await publishedCount(ctx, collection) : 0,
		faqCollectionExists: slugs.has(FAQ),
		articleLabel: label(collection, "Help articles"),
		faqLabel: label(FAQ, "FAQs"),
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

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;

export async function rateLimited(ctx: PluginContext, who: string): Promise<boolean> {
	if (!who) return false;
	const key = `rate:${who}`;
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const seen = await ctx.kv.getVersioned<string>(key);
		const [start, count] = (seen?.value || "0|0").split("|").map(Number);
		const now = Date.now();
		const fresh = now - start > RATE_WINDOW_MS;
		if (!fresh && count >= RATE_MAX) return true;
		const next = fresh ? `${now}|1` : `${start}|${count + 1}`;
		if ((await ctx.kv.compareAndSet(key, seen?.revision ?? null, next)).applied) return false;
	}
	return true;
}

export type EntryRef = { title: string; url: string; published: boolean };

export async function entryRef(ctx: PluginContext, collection: string, id: string): Promise<EntryRef | null> {
	const item = await ctx.content?.get?.(collection, id).catch(() => null);
	if (!item) return null;
	const published = item.status === "published";
	const url = published ? await ctx.content?.getPublicUrl?.(collection, id).catch(() => null) : null;
	return {
		title: asString(asRecord(item.data).title) || item.slug || id,
		url: url || "",
		published,
	};
}
