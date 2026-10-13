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

export async function listTopLevelCategories(ctx: PluginContext): Promise<ProductCard[]> {
	const terms = (await ctx.taxonomies?.getTerms(DOC_CATEGORY)) ?? [];
	const top = terms.filter((term) => !term.parentId);
	const cards: ProductCard[] = [];
	for (const term of top) {
		const stored = asRecord(await ctx.storage.product_icons.get(term.id));
		const icon = asString(stored.icon);
		cards.push({
			id: term.id,
			slug: term.slug,
			label: term.label,
			description: asString(asRecord(term.data).description),
			icon: isProductIcon(icon) ? icon : DEFAULT_PRODUCT_ICON,
		});
	}
	return cards.sort((a, b) => a.label.localeCompare(b.label));
}

export async function saveProductIcon(ctx: PluginContext, termId: string, icon: string): Promise<boolean> {
	if (!isProductIcon(icon)) return false;
	const terms = (await ctx.taxonomies?.getTerms(DOC_CATEGORY)) ?? [];
	const term = terms.find((item) => item.id === termId && !item.parentId);
	if (!term) return false;
	await ctx.storage.product_icons.put(term.id, {
		slug: term.slug,
		label: term.label,
		icon,
		updatedAt: nowIso(),
	});
	return true;
}
