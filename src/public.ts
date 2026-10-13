import type { PluginContext } from "emdash/plugin";

import { articleCollection, RATE_LIMITED, rateLimited } from "./core";
import { listTopLevelCategories, useProductLayer } from "./products";
import { loadSettings } from "./settings";
import { asBoolean, asNumber, asRecord, asString, nowIso } from "./util";
import { normaliseTerm, skipSearchTerm, visitorHash } from "./visitor";

type RouteCtx = { input: unknown; requestMeta?: unknown };

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

export async function handleLogSearch(routeCtx: RouteCtx, ctx: PluginContext) {
	const raw = asRecord(routeCtx.input);
	if (asString(raw.website) || asString(raw.hp)) return { ok: true };
	const who = await visitorHash(ctx, routeCtx, raw);
	if (await rateLimited(ctx, `search:${who}`)) return RATE_LIMITED;
	const term = normaliseTerm(raw.q);
	if (skipSearchTerm(term)) return { ok: true };
	const results = Math.max(0, asNumber(raw.found) ?? 0);
	const lastAt = nowIso();
	const existing = asRecord(await ctx.storage.searches.get(term));
	if (!existing.term) {
		await ctx.storage.searches.put(term, { term, count: 1, found: results > 0, results, lastAt });
		return { ok: true };
	}
	const updated = await ctx.storage.searches.updateIf(term, {
		where: {},
		delta: { count: { inc: 1 } },
		set: { found: results > 0, results, lastAt },
	});
	if (!updated.applied) {
		await ctx.storage.searches.put(term, {
			term,
			count: (asNumber(existing.count) ?? 0) + 1,
			found: results > 0,
			results,
			lastAt,
		});
	}
	return { ok: true };
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

export async function handleHelpful(routeCtx: RouteCtx, ctx: PluginContext) {
	const raw = asRecord(routeCtx.input);
	const id = asString(raw.id);
	if (!id) return fail("VALIDATION_ERROR");
	const collection = await articleCollection(ctx);
	const entry = await ctx.content?.get(collection, id).catch(() => null);
	if (!entry || entry.status !== "published") return fail("NOT_FOUND");
	const who = await visitorHash(ctx, routeCtx, raw);
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
