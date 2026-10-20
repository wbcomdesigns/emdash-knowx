import type { PluginContext } from "emdash/plugin";

import { DOCS } from "./core";
import { asRecord, asString, asStringArray } from "./util";

export const SEARCH_COLLECTION_CAP = 5;

export type KnowxSettings = {
	collection: string;
	askComment: boolean;
	contactUrl: string;
	searchCollections: string[];
	/** Plugin version for which the owner said the visitor pages are set up ("" when not). */
	kitDone: string;
	/** How far bringing data over from 0.1.x has got (see upgrade.ts). */
	upgrade: Record<string, unknown>;
};

/** Settings keys that are plugin state, never shown on the Settings page. */
export const KIT_DONE = "kit_pages_done";
export const UPGRADE = "upgrade_0_2";

export type CollectionChoice = {
	slug: string;
	label: string;
	searchable: boolean;
};

export function parseContactUrl(raw: unknown): { ok: true; value: string } | { ok: false } {
	// Control characters (tab, CR, LF and the rest) are refused before trimming: a browser drops
	// them from an address, so "/\t/evil.example" would become "//evil.example".
	if (typeof raw === "string" && /[\x00-\x1f\x7f]/.test(raw)) return { ok: false };
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

/** Every setting in one call (ctx.settings.list), so no path pays one call per setting. */
export async function loadSettings(ctx: PluginContext): Promise<KnowxSettings> {
	const all = new Map((await ctx.settings.list()).map((row) => [row.key, row.value]));
	const collection = asString(all.get("collection")) || DOCS;
	const chosen = asStringArray(all.get("search_collections"));
	// Checked again on read: a link saved before a stricter check (0.1.4) is never served.
	const contact = parseContactUrl(all.get("contact_url"));
	return {
		collection,
		askComment: all.get("ask_comment") !== false,
		contactUrl: contact.ok ? contact.value : "",
		searchCollections: chosen.length ? chosen : [collection],
		kitDone: asString(all.get(KIT_DONE)),
		upgrade: asRecord(all.get(UPGRADE)),
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
