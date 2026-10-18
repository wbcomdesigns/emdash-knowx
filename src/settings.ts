import type { PluginContext } from "emdash/plugin";

import { articleCollection, DOCS } from "./core";
import { asBoolean, asString, asStringArray } from "./util";

export const SEARCH_COLLECTION_CAP = 5;

export type KnowxSettings = {
	collection: string;
	askComment: boolean;
	contactUrl: string;
	searchCollections: string[];
};

export type CollectionChoice = {
	slug: string;
	label: string;
	searchable: boolean;
};

export function parseContactUrl(raw: unknown): { ok: true; value: string } | { ok: false } {
	const value = asString(raw);
	if (!value) return { ok: true, value: "" };
	// "/\evil.example" and "//evil.example" both leave the site in a browser. No address needs a backslash.
	if (/^(javascript|data|vbscript):/i.test(value) || value.startsWith("//") || value.includes("\\")) return { ok: false };
	if (/^mailto:[^\s@]+@[^\s@]+$/i.test(value)) return { ok: true, value };
	if (/^https?:\/\//i.test(value)) {
		try {
			const url = new URL(value);
			if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
			return { ok: true, value };
		} catch {
			return { ok: false };
		}
	}
	if (value.startsWith("/") && !value.includes("://")) return { ok: true, value };
	return { ok: false };
}

export async function loadSettings(ctx: PluginContext): Promise<KnowxSettings> {
	const collection = await articleCollection(ctx);
	const chosen = asStringArray(await ctx.settings.get<string>("search_collections"));
	return {
		collection,
		askComment: (await ctx.settings.get<boolean>("ask_comment")) !== false,
		contactUrl: asString(await ctx.settings.get<string>("contact_url")),
		searchCollections: chosen.length ? chosen : [collection],
	};
}

export async function listContentTypes(ctx: PluginContext): Promise<CollectionChoice[]> {
	const collections = (await ctx.schema?.listCollections()) ?? [];
	return collections
		.filter((item) => !item.hidden)
		.map((item) => ({
			slug: item.slug,
			label: item.label || item.slug,
			searchable: (item.supports || []).includes("search"),
		}));
}

export function parseSearchCollections(raw: unknown, fallback: string): { ok: true; value: string[] } | { ok: false; reason: string } {
	const chosen = [...new Set(asStringArray(raw))];
	if (!chosen.length) return { ok: false, reason: "Tick at least one content type." };
	if (chosen.length > SEARCH_COLLECTION_CAP) {
		return {
			ok: false,
			reason: `Tick at most ${SEARCH_COLLECTION_CAP} content types. Each extra type costs another search.`,
		};
	}
	return { ok: true, value: chosen.length ? chosen : [fallback || DOCS] };
}

export function searchCollectionsSetting(values: string[]): string {
	return values.join(",");
}
