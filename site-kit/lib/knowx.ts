import { callPluginRoute } from "./wbcom-kit";
import { kx, kindLabel } from "./knowx-strings";

export const HELP_PATH = "/docs";
export const VID_COOKIE = "knowx_vid";
export const PLUGIN = "knowx";

export type KnowxConfig = {
	ok?: boolean;
	searchCollections: string[];
	contactUrl: string;
	askComment: boolean;
};

export type ProductItem = { slug: string; label: string; description: string; icon: string };

export function jsonForScript(value: unknown): string {
	return JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}

function unwrap(json: unknown): Record<string, unknown> {
	if (!json || typeof json !== "object") return {};
	const row = json as Record<string, unknown>;
	if (row.data && typeof row.data === "object") return row.data as Record<string, unknown>;
	return row;
}

/** A KnowX public route, run inside the server from an Astro page (pass Astro.locals). */
export async function pluginJson(locals: unknown, path: string, body?: unknown): Promise<Record<string, unknown>> {
	return (await callPluginRoute(locals, PLUGIN, path, body)) as Record<string, unknown>;
}

/** Search snippet with marks stripped. Empty when it only repeats the title. */
export function snippetPlain(snippet: string): string {
	return snippet.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Line under a search hit. Keep marked HTML when it adds words beyond the title.
 * Otherwise return empty so the page can show the article excerpt instead.
 */
export function resultSnippet(title: string, snippet?: string): string {
	if (!snippet) return "";
	const plain = snippetPlain(snippet);
	const label = (title || "").replace(/\s+/g, " ").trim();
	if (!plain || plain.toLowerCase() === label.toLowerCase()) return "";
	return snippet;
}

export async function loadConfig(locals: unknown): Promise<KnowxConfig> {
	try {
		const data = await pluginJson(locals, "config");
		const chosen = Array.isArray(data.searchCollections)
			? data.searchCollections.filter((item): item is string => typeof item === "string" && item.length > 0)
			: [];
		return {
			ok: data.ok !== false,
			searchCollections: chosen.length ? chosen : ["docs"],
			contactUrl: typeof data.contactUrl === "string" ? data.contactUrl : "",
			askComment: data.askComment !== false,
		};
	} catch {
		return { searchCollections: ["docs"], contactUrl: "", askComment: true };
	}
}

export async function loadProducts(locals: unknown): Promise<{ productLayer: boolean; items: ProductItem[] }> {
	try {
		const data = await pluginJson(locals, "products");
		const items = Array.isArray(data.items)
			? data.items.flatMap((item) => {
					if (!item || typeof item !== "object") return [];
					const row = item as Record<string, unknown>;
					const slug = typeof row.slug === "string" ? row.slug : "";
					const label = typeof row.label === "string" ? row.label : "";
					if (!slug || !label) return [];
					return [
						{
							slug,
							label,
							description: typeof row.description === "string" ? row.description : "",
							icon: typeof row.icon === "string" ? row.icon : "book",
						},
					];
				})
			: [];
		return { productLayer: data.productLayer === true, items };
	} catch {
		return { productLayer: false, items: [] };
	}
}

export function headingId(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "section"
	);
}

export function headingsFrom(blocks: unknown): Array<{ id: string; text: string; level: 2 | 3 }> {
	if (!Array.isArray(blocks)) return [];
	const used = new Map<string, number>();
	const out: Array<{ id: string; text: string; level: 2 | 3 }> = [];
	for (const block of blocks) {
		if (!block || typeof block !== "object") continue;
		const row = block as { style?: unknown; children?: Array<{ text?: unknown }> };
		if (row.style !== "h2" && row.style !== "h3") continue;
		const text = (row.children || []).map((child) => String(child.text || "")).join("");
		if (!text) continue;
		const base = headingId(text);
		const n = (used.get(base) || 0) + 1;
		used.set(base, n);
		out.push({ id: n === 1 ? base : `${base}-${n}`, text, level: row.style === "h2" ? 2 : 3 });
	}
	return out;
}

export function siteZone(value: unknown): string {
	const zone = typeof value === "string" ? value.trim() : "";
	if (!zone) return "UTC";
	try {
		new Intl.DateTimeFormat("en", { timeZone: zone });
		return zone;
	} catch {
		return "UTC";
	}
}

export function isoDate(value: Date | string | null | undefined): string {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function formatSiteDate(value: Date | string | null | undefined, timeZone: string, dateFormat?: string): string {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const style = dateFormat === "short" || dateFormat === "long" || dateFormat === "full" ? dateFormat : "medium";
	try {
		return new Intl.DateTimeFormat("en", { timeZone, dateStyle: style }).format(date);
	} catch {
		return date.toISOString().slice(0, 10);
	}
}

export function resultKind(collection: string): string {
	return kindLabel(collection);
}

export function resultHref(collection: string, slug: string | null, routeMap: Record<string, string> = {}): string {
	if (!slug) return HELP_PATH;
	const template = routeMap[collection];
	if (template) return template.replace(":slug", slug).replace(":path", slug);
	if (collection === "faq") return `${HELP_PATH}/faq#${slug}`;
	if (collection === "docs") return `${HELP_PATH}/${slug}`;
	if (collection === "posts") return `/posts/${slug}`;
	if (collection === "pages") return `/${slug}`;
	return `/${collection}/${slug}`;
}

export const SEARCH_ROUTES: Record<string, string> = {
	docs: `${HELP_PATH}/:slug`,
	faq: `${HELP_PATH}/faq#:slug`,
	posts: "/posts/:slug",
	pages: "/pages/:slug",
};

export function visitorIdFromCookie(raw: string | undefined): string {
	return raw && raw.length < 80 ? raw : crypto.randomUUID();
}

export { kx, kindLabel };
