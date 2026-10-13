import type { PluginContext } from "emdash/plugin";

import { collectionStatus } from "./core";
import { listTopLevelCategories, PRODUCT_ICONS, saveProductIcon, useProductLayer } from "./products";
import {
	listContentTypes,
	loadSettings,
	parseContactUrl,
	parseSearchCollections,
	SEARCH_COLLECTION_CAP,
	searchCollectionsSetting,
} from "./settings";
import { asBoolean, asRecord, asString } from "./util";

type Toast = { message: string; type: "success" | "error" | "info" };
export type BlockResponse = { blocks: Array<Record<string, unknown>>; toast?: Toast };

const lines = (items: string[]) => items.map((text) => ({ type: "context", text }));

export async function renderInsights(
	ctx: PluginContext,
	extra?: Pick<BlockResponse, "toast">,
): Promise<BlockResponse> {
	const status = await collectionStatus(ctx);
	if (!status.collectionExists) {
		return {
			blocks: [
				{ type: "header", text: "Insights" },
				{
					type: "empty",
					title: "Help articles are not set up",
					description: "Add the help collection from the site kit seed, then come back here.",
				},
			],
			toast: extra?.toast,
		};
	}

	const articleLine =
		status.articleCount === 0
			? "The help collection is ready. No published articles yet."
			: `${status.articleCount} published help ${status.articleCount === 1 ? "article" : "articles"}.`;

	return {
		blocks: [
			{ type: "header", text: "Insights" },
			{ type: "section", text: articleLine },
			{
				type: "section",
				text: status.faqCollectionExists
					? "The FAQ collection is ready."
					: "The FAQ collection is not set up yet.",
			},
			{
				type: "empty",
				title: "No reports yet",
				description: "Helpfulness and search reports appear here after readers use the help center.",
			},
		],
		toast: extra?.toast,
	};
}

export async function renderSettings(
	ctx: PluginContext,
	extra?: Pick<BlockResponse, "toast">,
): Promise<BlockResponse> {
	const settings = await loadSettings(ctx);
	const types = await listContentTypes(ctx);
	const products = await listTopLevelCategories(ctx);
	const options = types.map((item) => ({
		label: item.searchable ? item.label : `${item.label} (search off)`,
		value: item.slug,
	}));
	const iconOptions = PRODUCT_ICONS.map((item) => ({ label: item.label, value: item.slug }));

	return {
		blocks: [
			{ type: "header", text: "Settings" },
			{ type: "section", text: "Each group saves on its own." },
			{ type: "header", text: "After a No vote" },
			...lines(["Ask the reader what was missing after they vote No on an article."]),
			{
				type: "form",
				block_id: "settings_feedback",
				fields: [
					{
						type: "toggle",
						action_id: "ask_comment",
						label: "Ask for a comment after a No vote",
						initial_value: settings.askComment,
					},
				],
				submit: { label: "Save feedback", action_id: "save_feedback" },
			},
			{ type: "divider" },
			{ type: "header", text: "Still need help" },
			...lines([
				"Shown after a search with no results and after a No vote. A page path, an http(s) link, or a mailto address. Leave empty to hide the prompt.",
			]),
			{
				type: "form",
				block_id: "settings_contact",
				fields: [
					{
						type: "text_input",
						action_id: "contact_url",
						label: "Contact link",
						initial_value: settings.contactUrl,
					},
				],
				submit: { label: "Save contact link", action_id: "save_contact" },
			},
			{ type: "divider" },
			{ type: "header", text: "What search looks through" },
			...lines([
				`Tick the site's content types. Help search uses EmDash search, so a type with search turned off will not return results. At most ${SEARCH_COLLECTION_CAP}, because each extra type costs another search.`,
			]),
			options.length
				? {
						type: "form",
						block_id: "settings_search",
						fields: [
							{
								type: "checkbox",
								action_id: "search_collections",
								label: "Content types",
								options,
								initial_value: settings.searchCollections.filter((slug) =>
									options.some((item) => item.value === slug),
								),
							},
						],
						submit: { label: "Save search", action_id: "save_search" },
					}
				: {
						type: "empty",
						title: "No content types found",
						description: "The site has no collections to search yet.",
					},
			{ type: "divider" },
			{ type: "header", text: "Product icons" },
			...lines([
				useProductLayer(products)
					? "Each top-level category is a product card on the help home. Pick an icon from this set. The description is the category description."
					: "With one top-level category the help home shows a plain list, not product cards. You can still pick an icon here for later.",
			]),
			products.length
				? {
						type: "form",
						block_id: "settings_icons",
						fields: products.map((item) => ({
							type: "select",
							action_id: `icon__${item.id}`,
							label: item.label,
							initial_value: item.icon,
							options: iconOptions,
						})),
						submit: { label: "Save icons", action_id: "save_icons" },
					}
				: {
						type: "empty",
						title: "No help categories yet",
						description: "Add a help category, then pick an icon here.",
					},
		],
		toast: extra?.toast,
	};
}

async function saveSettings(input: Record<string, unknown>, ctx: PluginContext): Promise<BlockResponse> {
	const action = asString(input.action_id);
	const values = asRecord(input.values);
	const saved = (message: string) => renderSettings(ctx, { toast: { message, type: "success" } });
	const refused = (message: string) => renderSettings(ctx, { toast: { message, type: "error" } });

	if (action === "save_feedback") {
		await ctx.settings.set("ask_comment", asBoolean(values.ask_comment));
		return saved("Feedback setting saved.");
	}

	if (action === "save_contact") {
		const parsed = parseContactUrl(values.contact_url);
		if (!parsed.ok) {
			return refused("Use a page path, an http(s) link, or a mailto address. Nothing was changed.");
		}
		await ctx.settings.set("contact_url", parsed.value);
		return saved(parsed.value ? "Contact link saved." : "Contact link cleared. The prompt is hidden.");
	}

	if (action === "save_search") {
		const settings = await loadSettings(ctx);
		const parsed = parseSearchCollections(values.search_collections, settings.collection);
		if (!parsed.ok) return refused(parsed.reason);
		const known = new Set((await listContentTypes(ctx)).map((item) => item.slug));
		const value = parsed.value.filter((slug) => known.has(slug));
		if (!value.length) return refused("Tick at least one content type that exists on this site.");
		await ctx.settings.set("search_collections", searchCollectionsSetting(value));
		return saved("Search coverage saved.");
	}

	if (action === "save_icons") {
		let savedCount = 0;
		for (const [key, raw] of Object.entries(values)) {
			if (!key.startsWith("icon__")) continue;
			const termId = key.slice("icon__".length);
			if (await saveProductIcon(ctx, termId, asString(raw))) savedCount += 1;
		}
		if (!savedCount) return refused("Pick an icon from the list. Nothing was changed.");
		return saved("Product icons saved.");
	}

	return renderSettings(ctx);
}

export async function handleAdmin(input: unknown, ctx: PluginContext): Promise<BlockResponse> {
	const raw = asRecord(input);
	const page = asString(raw.page);
	if (asString(raw.type) === "form_submit") return saveSettings(raw, ctx);
	if (page.includes("settings")) return renderSettings(ctx);
	return renderInsights(ctx);
}
