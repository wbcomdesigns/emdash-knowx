import type { PluginContext } from "emdash/plugin";

import { DOC_CATEGORY } from "./core";
import { asRecord, asString, nowIso } from "./util";

export const PRODUCT_ICONS = [
	{ slug: "book", label: "Book" },
	{ slug: "rocket", label: "Rocket" },
	{ slug: "bag", label: "Bag" },
	{ slug: "people", label: "People" },
	{ slug: "card", label: "Card" },
	{ slug: "wrench", label: "Wrench" },
	{ slug: "shield", label: "Shield" },
	{ slug: "globe", label: "Globe" },
	{ slug: "chat", label: "Chat" },
	{ slug: "star", label: "Star" },
	{ slug: "heart", label: "Heart" },
	{ slug: "briefcase", label: "Briefcase" },
	{ slug: "list", label: "List" },
	{ slug: "code", label: "Code" },
	{ slug: "map", label: "Map" },
] as const;

export const DEFAULT_PRODUCT_ICON = "book";

export type ProductIconSlug = (typeof PRODUCT_ICONS)[number]["slug"];

export type ProductCard = {
	id: string;
	slug: string;
	label: string;
	description: string;
	icon: string;
};

export function isProductIcon(value: string): value is ProductIconSlug {
	return PRODUCT_ICONS.some((item) => item.slug === value);
}

export function useProductLayer(products: ProductCard[]): boolean {
	return products.length > 1;
}

/**
 * Top-level help categories with their icons, sorted by name. Two calls: the terms, then every
 * stored icon at once (one read per category was 13 calls for 12 categories).
 */
export async function listTopLevelCategories(ctx: PluginContext): Promise<ProductCard[]> {
	const terms = (await ctx.taxonomies?.getTerms(DOC_CATEGORY)) ?? [];
	const top = terms.filter((term) => !term.parentId);
	const stored = top.length ? await ctx.storage.product_icons.getMany(top.map((term) => term.id)) : new Map();
	return top
		.map((term) => {
			const icon = asString(asRecord(stored.get(term.id)).icon);
			return {
				id: term.id,
				slug: term.slug,
				label: term.label,
				description: asString(asRecord(term.data).description),
				icon: isProductIcon(icon) ? icon : DEFAULT_PRODUCT_ICON,
			};
		})
		.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Store the icons picked on the Settings page in one write. `products` is the list the page was
 * built from (top-level categories only); a field for any other id is ignored. Returns how many
 * icons were valid.
 */
export async function saveProductIcons(ctx: PluginContext, products: ProductCard[], values: Record<string, unknown>): Promise<number> {
	const now = nowIso();
	const rows = [];
	for (const product of products) {
		const icon = asString(values[`icon__${product.id}`]);
		if (!isProductIcon(icon)) continue;
		rows.push({ id: product.id, data: { slug: product.slug, label: product.label, icon, updatedAt: now } });
	}
	if (rows.length) await ctx.storage.product_icons.putMany(rows);
	return rows.length;
}
