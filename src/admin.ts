import type { PluginContext } from "emdash/plugin";

import { articleCollection, collectionStatus, entryRef } from "./core";
import { listTopLevelCategories, PRODUCT_ICONS, saveProductIcon, useProductLayer } from "./products";
import {
	listContentTypes,
	loadSettings,
	parseContactUrl,
	parseSearchCollections,
	SEARCH_COLLECTION_CAP,
	searchCollectionsSetting,
} from "./settings";
import { asBoolean, asNumber, asRecord, asString } from "./util";

type Toast = { message: string; type: "success" | "error" | "info" };
export type BlockResponse = { blocks: Array<Record<string, unknown>>; toast?: Toast };

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

	const reports = await insightTables(ctx);
	const setup = status.faqCollectionExists
		? []
		: [
				{
					type: "empty",
					title: "The FAQ collection is not set up yet",
					description: "Add the FAQ collection from the site kit seed when you want a FAQ page.",
				},
			];
	return {
		blocks: [
			{ type: "header", text: "Insights" },
			...setup,
			await insightStats(ctx, status.articleCount),
			...reports,
		],
		toast: extra?.toast,
	};
}

async function insightStats(ctx: PluginContext, articleCount: number): Promise<Record<string, unknown>> {
	const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	let searchesThisWeek = 0;
	let emptyThisWeek = 0;
	let yes = 0;
	let no = 0;
	const series: Array<[number, number]> = [];
	try {
		const searches = await ctx.storage.searches.query({ limit: 200, orderBy: { lastAt: "desc" } });
		const days = new Map<number, number>();
		for (let i = 13; i >= 0; i--) {
			const day = new Date();
			day.setHours(0, 0, 0, 0);
			day.setDate(day.getDate() - i);
			days.set(day.getTime(), 0);
		}
		for (const item of searches.items) {
			try {
				const row = asRecord(item.data);
				const last = asString(row.lastAt);
				const count = asNumber(row.count) ?? 0;
				if (last && last >= weekStart) {
					searchesThisWeek += count;
					if (row.found === false) emptyThisWeek += count;
				}
				if (!last) continue;
				const day = new Date(last);
				day.setHours(0, 0, 0, 0);
				const key = day.getTime();
				if (days.has(key)) days.set(key, (days.get(key) || 0) + count);
			} catch {
				/* one bad row must not hide the page */
			}
		}
		for (const [time, value] of days) series.push([time, value]);
	} catch {
		searchesThisWeek = 0;
	}
	try {
		const votes = await ctx.storage.feedback.query({ limit: 200, orderBy: { createdAt: "desc" } });
		for (const item of votes.items) {
			try {
				const row = asRecord(item.data);
				if (row.helpful === true) yes += 1;
				else no += 1;
			} catch {
				/* skip */
			}
		}
	} catch {
		yes = 0;
		no = 0;
	}
	const totalVotes = yes + no;
	const rate = totalVotes ? `${Math.round((yes / totalVotes) * 100)}%` : "None yet";
	return {
		type: "columns",
		columns: [
			[
				{
					type: "stats",
					items: [
						{ label: "Articles", value: String(articleCount) },
						{ label: "Searches this week", value: String(searchesThisWeek) },
						{ label: "Searches with no results", value: String(emptyThisWeek) },
						{ label: "Helpful rate", value: rate },
					],
				},
			],
			[
				{
					type: "chart",
					config: {
						chart_type: "timeseries",
						series: [{ name: "Searches", data: series }],
						x_axis_name: "Day",
						y_axis_name: "Searches",
						style: "line",
						height: 220,
					},
				},
			],
		],
	};
}

async function insightTables(ctx: PluginContext): Promise<Array<Record<string, unknown>>> {
	const blocks: Array<Record<string, unknown>> = [];
	const collection = await articleCollection(ctx);
	const titles = new Map<string, string>();
	const titleOf = async (doc: string) => {
		const cached = titles.get(doc);
		if (cached) return cached;
		const title = (await entryRef(ctx, collection, doc).catch(() => null))?.title || "Help article";
		titles.set(doc, title);
		return title;
	};

	try {
		const votes = await ctx.storage.feedback.query({ limit: 200, orderBy: { createdAt: "desc" } });
		const byDoc = new Map<string, { yes: number; no: number }>();
		const comments: Array<{ article: string; comment: string }> = [];
		for (const item of votes.items) {
			try {
				const row = asRecord(item.data);
				const doc = asString(row.doc) || item.id.split(":")[0];
				const bucket = byDoc.get(doc) || { yes: 0, no: 0 };
				if (row.helpful === true) bucket.yes += 1;
				else bucket.no += 1;
				byDoc.set(doc, bucket);
				const comment = asString(row.comment);
				if (comment) comments.push({ article: await titleOf(doc), comment });
			} catch {
				/* one bad row must not hide the page */
			}
		}
		const weakRows = [];
		for (const [doc, n] of [...byDoc.entries()]
			.filter(([, v]) => v.no > v.yes)
			.sort(([, a], [, b]) => b.no - a.no)
			.slice(0, 10)) {
			try {
				weakRows.push({ article: await titleOf(doc), no: String(n.no), yes: String(n.yes) });
			} catch {
				weakRows.push({ article: "Help article", no: String(n.no), yes: String(n.yes) });
			}
		}
		blocks.push({ type: "header", text: "Least helpful articles" });
		blocks.push(
			weakRows.length
				? { type: "table", page_action_id: "weak_page", columns: cols("article", "no", "yes"), rows: weakRows }
				: { type: "empty", title: "No weak articles yet", description: "A No vote that outnumbers Yes will show here." },
		);
		blocks.push({ type: "header", text: "Recent comments" });
		blocks.push(
			comments.length
				? { type: "table", page_action_id: "comments_page", columns: cols("article", "comment"), rows: comments.slice(0, 20) }
				: { type: "empty", title: "No comments yet", description: "Comments after a No vote show here as plain text." },
		);
	} catch {
		blocks.push({ type: "empty", title: "Helpfulness could not be loaded", description: "Try again in a moment." });
	}

	try {
		const searches = await ctx.storage.searches.query({ limit: 50, orderBy: { count: "desc" } });
		const top = searches.items.map((item) => {
			const row = asRecord(item.data);
			return { term: asString(row.term) || item.id, times: String(row.count ?? 0) };
		});
		const empty = searches.items
			.filter((item) => asRecord(item.data).found === false)
			.map((item) => {
				const row = asRecord(item.data);
				return { term: asString(row.term) || item.id, times: String(row.count ?? 0) };
			});
		blocks.push({ type: "header", text: "Top searches" });
		blocks.push(
			top.length
				? { type: "table", page_action_id: "top_page", columns: cols("term", "times"), rows: top }
				: { type: "empty", title: "No searches yet", description: "Terms from the help search page show here." },
		);
		blocks.push({ type: "header", text: "Searches with no results" });
		blocks.push(
			empty.length
				? { type: "table", page_action_id: "empty_page", columns: cols("term", "times"), rows: empty }
				: { type: "empty", title: "No empty searches yet", description: "A search that found nothing shows here." },
		);
	} catch {
		blocks.push({ type: "empty", title: "Search log could not be loaded", description: "Try again in a moment." });
	}
	return blocks;
}

function cols(...keys: string[]) {
	return keys.map((key) => ({
		key,
		label: key === "no" ? "No" : key === "yes" ? "Yes" : key[0].toUpperCase() + key.slice(1),
	}));
}

export async function renderSettings(
	ctx: PluginContext,
	extra?: Pick<BlockResponse, "toast">,
): Promise<BlockResponse> {
	const settings = await loadSettings(ctx);
	const types = await listContentTypes(ctx);
	const products = await listTopLevelCategories(ctx);
	const options = types.map((item) => ({
		label: item.label,
		value: item.slug,
	}));
	const offSearch = types.filter((item) => !item.searchable).map((item) => item.label);
	const iconOptions = PRODUCT_ICONS.map((item) => ({ label: item.label, value: item.slug }));
	const searchHint = offSearch.length
		? `Turn search on for ${offSearch.join(", ")} in EmDash if you want ${offSearch.length === 1 ? "it" : "them"} in results. At most ${SEARCH_COLLECTION_CAP} types.`
		: `Tick the types help search should cover. At most ${SEARCH_COLLECTION_CAP}, because each extra type costs another search.`;

	return {
		blocks: [
			{ type: "header", text: "Settings" },
			{
				type: "tab",
				panels: [
					{
						label: "Feedback",
						blocks: [
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
								submit: { label: "Save", action_id: "save_feedback" },
							},
							{ type: "context", text: "Shown after a reader votes No on an article." },
						],
					},
					{
						label: "Still need help",
						blocks: [
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
								submit: { label: "Save", action_id: "save_contact" },
							},
							{
								type: "context",
								text: "A page path, an http(s) link, or a mailto address. Leave empty to hide the prompt.",
							},
						],
					},
					{
						label: "Search",
						blocks: [
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
										submit: { label: "Save", action_id: "save_search" },
									}
								: {
										type: "empty",
										title: "No content types found",
										description: "The site has no collections to search yet.",
									},
							{ type: "context", text: searchHint },
						],
					},
					{
						label: "Product icons",
						blocks: [
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
										submit: { label: "Save", action_id: "save_icons" },
									}
								: {
										type: "empty",
										title: "No help categories yet",
										description: "Add a help category, then pick an icon here.",
									},
							{
								type: "context",
								text: useProductLayer(products)
									? "Each top-level category is a product card on the help home."
									: "With one top-level category the help home shows a list. You can still pick an icon here.",
							},
						],
					},
				],
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

/** Card on the EmDash dashboard: empty searches this week, and the least helpful article. */
export async function renderDashboard(ctx: PluginContext): Promise<BlockResponse> {
	const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	let emptyThisWeek = 0;
	try {
		const searches = await ctx.storage.searches.query({ limit: 200, orderBy: { count: "desc" } });
		for (const item of searches.items) {
			try {
				const row = asRecord(item.data);
				if (row.found !== false) continue;
				const last = asString(row.lastAt);
				if (last && last >= weekStart) emptyThisWeek += 1;
			} catch {
				/* one bad row must not hide the card */
			}
		}
	} catch {
		emptyThisWeek = 0;
	}

	let weakest = "";
	try {
		const votes = await ctx.storage.feedback.query({ limit: 200, orderBy: { createdAt: "desc" } });
		const byDoc = new Map<string, { yes: number; no: number }>();
		for (const item of votes.items) {
			try {
				const row = asRecord(item.data);
				const doc = asString(row.doc) || item.id.split(":")[0];
				const bucket = byDoc.get(doc) || { yes: 0, no: 0 };
				if (row.helpful === true) bucket.yes += 1;
				else bucket.no += 1;
				byDoc.set(doc, bucket);
			} catch {
				/* skip */
			}
		}
		const worst = [...byDoc.entries()]
			.filter(([, v]) => v.no > v.yes)
			.sort(([, a], [, b]) => b.no - a.no)[0];
		if (worst) {
			const collection = await articleCollection(ctx);
			weakest = (await entryRef(ctx, collection, worst[0]).catch(() => null))?.title || "Help article";
		}
	} catch {
		weakest = "";
	}

	const emptyLine =
		emptyThisWeek === 0
			? "No empty searches this week."
			: emptyThisWeek === 1
				? "1 search found nothing this week."
				: `${emptyThisWeek} searches found nothing this week.`;
	const weakLine = weakest
		? `Least helpful article: ${weakest}.`
		: "No article has more No votes than Yes yet.";

	return {
		blocks: [
			{ type: "section", text: emptyLine },
			{ type: "section", text: weakLine },
			{
				type: "actions",
				elements: [{ type: "link", label: "Open Insights", target: { kind: "plugin-page", path: "/insights" } }],
			},
		],
	};
}

export async function handleAdmin(input: unknown, ctx: PluginContext): Promise<BlockResponse> {
	const raw = asRecord(input);
	const page = asString(raw.page);
	if (asString(raw.widget) === "insights" || page.includes("widget:insights")) return renderDashboard(ctx);
	if (asString(raw.type) === "form_submit") return saveSettings(raw, ctx);
	if (page.includes("settings")) return renderSettings(ctx);
	return renderInsights(ctx);
}
