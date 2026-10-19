import type { PluginContext } from "emdash/plugin";

import { articleCollection, collectionStatus, entryRef, FAQ, publishedCount } from "./core";
import { dayTotals } from "./public";
import { emptySearches, feedbackSummary } from "./report";
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

const KIT_DONE = "kit_pages_done";
const REPO_URL = "https://github.com/wbcomdesigns/emdash-knowx";

/** The shared six-line kit command (starter BEFORE_YOU_INSTALL.md). */
export function kitCommand(tag: string): string {
	return [
		`kit="$(mktemp -d)" &&`,
		`  git clone --depth 1 \\`,
		`    --branch ${tag} \\`,
		`    ${REPO_URL} \\`,
		`    "$kit/emdash-knowx" &&`,
		`  "$kit/emdash-knowx/scripts/add-to-site.sh" .`,
	].join("\n");
}

function guideUrl(ctx: PluginContext, anchor = ""): string {
	return `${REPO_URL}/blob/v${ctx.plugin.version}/docs/website/getting-started/install.md${anchor}`;
}

/**
 * The "Set up visitor pages" card. A registry plugin cannot add pages, so until the site kit is
 * copied every KnowX address is the site's 404. The card gives the command for the version that
 * is installed (never main), until the owner says the pages are set up; then one line to the guide.
 */
export async function kitBlocks(ctx: PluginContext): Promise<Array<Record<string, unknown>>> {
	const tag = `v${ctx.plugin.version}`;
	const guide = { type: "link", label: "Install guide", target: { kind: "external", url: guideUrl(ctx) } };
	if ((await ctx.kv.get<string>(KIT_DONE)) === "1") {
		return [
			{ type: "context", text: `Visitor pages come from the KnowX site kit. After each plugin update, copy the kit for ${tag} again.` },
			{ type: "actions", elements: [guide, { type: "button", action_id: "kit_show", label: "Show the setup steps again" }] },
		];
	}
	return [
		{
			type: "banner",
			title: "Set up visitor pages",
			description:
				"Installing KnowX adds this admin, not pages on your site. The help pages come from the KnowX site kit. Until you copy it, the addresses below show your site's 404 page.",
			variant: "default",
		},
		{ type: "context", text: `From your site's root folder, run this command. It copies the kit for the version you have installed (${tag}) and creates the Help articles and FAQs content types. Run it again after each update.` },
		{
			type: "code",
			language: "bash",
			// A fresh private folder per run (never a fixed /tmp path), and the script runs only when the
			// clone worked. Six lines of 52 characters or fewer: a code block neither wraps nor scrolls,
			// and this fits it at 768 and wider. On a phone the guide link below has the same command.
			code: kitCommand(tag),
		},
		{ type: "actions", elements: [{ ...guide, label: "Copy it from the install guide on a phone" }] },
		// Plain text that wraps, not a fields block: a fields value is clipped at 390 (#46).
		{
			type: "section",
			text: "Visitor addresses the kit adds: /docs/ (help home), /docs/<article>/ (one article), /docs/category/<topic>/ (a topic), /docs/search (search results), /docs/faq/ (the FAQ page).",
		},
		{ type: "context", text: "Then add your first help article in Content, Help articles, and your first question in Content, FAQs." },
		{
			type: "actions",
			elements: [guide, { type: "button", action_id: "kit_done", label: "Visitor pages are set up", style: "primary" }],
		},
	];
}

/** One plain line when this host gives EmDash no visitor address, so guests cannot vote. */
function guestBlocks(ctx: PluginContext, guestWrites: boolean): Array<Record<string, unknown>> {
	if (guestWrites) return [];
	return [
		{
			type: "banner",
			title: "Guests cannot vote on this host",
			description:
				"This host does not tell EmDash the visitor's address, so KnowX cannot limit guests. Guests see Yes and No on Was this helpful as unavailable, with a sign-in link, and searches are not counted on Insights. Signed-in members still vote. To let guests vote, run the site on Cloudflare or set trustedProxyHeaders inside emdash({ ... }) in astro.config.mjs.",
			variant: "default",
		},
		{
			type: "actions",
			elements: [{ type: "link", label: "Guests and visitor addresses", target: { kind: "external", url: guideUrl(ctx, "#guests-and-visitor-addresses") } }],
		},
	];
}

export async function renderInsights(
	ctx: PluginContext,
	extra?: Pick<BlockResponse, "toast">,
	guestWrites = true,
	topView: TopView = { find: "" },
): Promise<BlockResponse> {
	const status = await collectionStatus(ctx);
	const top = [{ type: "header", text: "Insights" }, ...(await kitBlocks(ctx)), ...guestBlocks(ctx, guestWrites)];
	if (!status.collectionExists) {
		return {
			blocks: [
				...top,
				{
					type: "empty",
					title: "Help articles are not set up",
					description:
						"The kit command above creates the Help articles and FAQs content types. Then add your first article in Content, Help articles.",
				},
			],
			toast: extra?.toast,
		};
	}

	const faqCount = status.faqCollectionExists ? await publishedCount(ctx, FAQ) : 0;
	const firstSteps: Array<Record<string, unknown>> = [];
	if (status.articleCount === 0) {
		firstSteps.push({
			type: "empty",
			title: "Add your first help article",
			description: `In the admin menu open Content, ${status.articleLabel}, and choose Add New. Publish it and it shows on /docs/.`,
		});
	}
	if (!status.faqCollectionExists) {
		firstSteps.push({
			type: "empty",
			title: "The FAQ collection is not set up yet",
			description: "Run the kit command above again: it creates the FAQs content type and leaves your articles alone.",
		});
	} else if (faqCount === 0) {
		firstSteps.push({
			type: "empty",
			title: "Add your first FAQ",
			description: `In the admin menu open Content, ${status.faqLabel}, and choose Add New. Published questions show on /docs/faq/.`,
		});
	}
	// Read every vote once per load and share it between the stats and the tables.
	const votes = await feedbackSummary(ctx).catch(() => null);
	const reports = await insightTables(ctx, topView, votes);
	return {
		blocks: [...top, ...firstSteps, await insightStats(ctx, status.articleCount, votes), ...reports],
		toast: extra?.toast,
	};
}

async function insightStats(ctx: PluginContext, articleCount: number, votes: Votes): Promise<Record<string, unknown>> {
	let searchesThisWeek = 0;
	let emptyThisWeek = 0;
	let series: Array<[number, number]> = [];
	try {
		const days = await dayTotals(ctx, 14);
		for (const day of days.slice(-7)) {
			searchesThisWeek += day.searches;
			emptyThisWeek += day.empty;
		}
		series = days.map((day) => [day.day, day.searches]);
	} catch {
		searchesThisWeek = 0;
	}
	let rate = "None yet";
	try {
		if (!votes) throw new Error("votes not loaded");
		const { yes, no } = votes;
		if (yes + no) rate = `${Math.round((yes / (yes + no)) * 100)}%`;
	} catch {
		rate = "None yet";
	}
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
						x_axis_name: "Day (UTC)",
						y_axis_name: "Searches",
						style: "line",
						height: 220,
					},
				},
			],
		],
	};
}

const TOP_PAGE = 25;

/** Top searches: 25 at a time by count, with find by the start of the term. */
type TopView = { find: string; cursor?: string; page?: number };
type Votes = Awaited<ReturnType<typeof feedbackSummary>> | null;

async function topSearchBlocks(ctx: PluginContext, view: TopView): Promise<Array<Record<string, unknown>>> {
	const find = view.find.trim().toLowerCase();
	const page = await ctx.storage.searches.query({
		where: find ? { term: { startsWith: find } } : undefined,
		orderBy: { count: "desc" },
		limit: TOP_PAGE,
		cursor: view.cursor,
	} as never);
	const rows = page.items.map((item) => {
		const row = asRecord(item.data);
		return { term: asString(row.term) || item.id, times: String(row.count ?? 0) };
	});
	const total = await ctx.storage.searches.count(find ? ({ term: { startsWith: find } } as never) : undefined);
	const blocks: Array<Record<string, unknown>> = [
		{ type: "header", text: "Top searches" },
		{
			type: "form",
			block_id: "top_find",
			fields: [{ type: "text_input", action_id: "find", label: "Find terms that start with", initial_value: view.find }],
			submit: { label: view.find ? "Find again" : "Find", action_id: "top_find" },
		},
	];
	if (find || total > TOP_PAGE) {
		blocks.push({
			type: "context",
			text: find
				? `${total} ${total === 1 ? "term starts" : "terms start"} with "${view.find}". Clear the box and press Find to see every term.`
				: `${total} terms, most searched first, ${TOP_PAGE} at a time.${(view.page ?? 1) > 1 ? ` Page ${view.page}.` : ""}`,
		});
	}
	blocks.push(
		rows.length
			? { type: "table", page_action_id: "top_page", next_cursor: page.hasMore ? page.cursor : undefined, columns: cols("term", "times"), rows }
			: find
				? { type: "empty", title: "Nothing matches", description: "No searched term starts with that text." }
				: { type: "empty", title: "No searches yet", description: "Terms from the help search page show here." },
	);
	if ((view.page ?? 1) > 1) {
		blocks.push({
			type: "actions",
			elements: [
				{ type: "button", action_id: "top_prev", label: "Previous page" },
				{ type: "button", action_id: "top_first", label: "First page" },
			],
		});
	}
	return blocks;
}

async function insightTables(ctx: PluginContext, top: TopView, votes: Votes): Promise<Array<Record<string, unknown>>> {
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
		if (!votes) throw new Error("votes not loaded");
		const { weak, comments } = votes;
		const weakRows = [];
		for (const [doc, n] of weak.slice(0, 10)) weakRows.push({ article: await titleOf(doc), no: String(n.no), yes: String(n.yes) });
		const commentRows = [];
		for (const item of comments) commentRows.push({ article: await titleOf(item.doc), comment: item.comment });
		blocks.push({ type: "header", text: "Least helpful articles" });
		blocks.push(
			weakRows.length
				? { type: "table", page_action_id: "weak_page", columns: cols("article", "no", "yes"), rows: weakRows }
				: { type: "empty", title: "No weak articles yet", description: "A No vote that outnumbers Yes will show here." },
		);
		blocks.push({ type: "header", text: "Recent comments" });
		blocks.push(
			commentRows.length
				? { type: "table", page_action_id: "comments_page", columns: cols("article", "comment"), rows: commentRows }
				: { type: "empty", title: "No comments yet", description: "Comments after a No vote show here as plain text." },
		);
	} catch {
		blocks.push({ type: "empty", title: "Helpfulness could not be loaded", description: "Try again in a moment." });
	}

	try {
		blocks.push(...(await topSearchBlocks(ctx, top)));
		const empty = (await emptySearches(ctx)).slice(0, 50).map((item) => ({ term: item.term, times: String(item.times) }));
		blocks.push({ type: "header", text: "Searches with no results" });
		blocks.push(
			empty.length
				? { type: "table", page_action_id: "empty_page", columns: cols("term", "times"), rows: empty }
				: { type: "empty", title: "No empty searches yet", description: "A search that found nothing in the last 30 days shows here." },
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
		emptyThisWeek = (await emptySearches(ctx, weekStart)).length;
	} catch {
		emptyThisWeek = 0;
	}

	let weakest = "";
	try {
		const worst = (await feedbackSummary(ctx)).weak[0];
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

export async function handleAdmin(input: unknown, ctx: PluginContext, guestWrites = true): Promise<BlockResponse> {
	const raw = asRecord(input);
	const page = asString(raw.page);
	if (asString(raw.widget) === "insights" || page.includes("widget:insights")) return renderDashboard(ctx);
	const action = asString(raw.action_id);
	// Top searches: Find and Load more keep the find text in kv; opening the page starts fresh.
	// The cursors of the pages shown so far are kept, so Previous page and First page can go back.
	if (action === "top_find" || action === "top_page" || action === "top_prev" || action === "top_first") {
		const saved = asRecord(await ctx.kv.get("view:top"));
		let find = asString(saved.find);
		let pages = Array.isArray(saved.pages) ? saved.pages.map(asString).slice(-200) : [""];
		if (!pages.length) pages = [""];
		if (action === "top_find") {
			find = asString(asRecord(raw.values).find).slice(0, 80);
			pages = [""];
		} else if (action === "top_page") pages.push(asString(asRecord(raw.value).cursor));
		else if (action === "top_prev") pages = pages.length > 1 ? pages.slice(0, -1) : [""];
		else pages = [""];
		await ctx.kv.set("view:top", { find, pages });
		const cursor = pages[pages.length - 1] || undefined;
		return renderInsights(ctx, undefined, guestWrites, { find, cursor, page: pages.length });
	}
	if (asString(raw.type) === "form_submit") return saveSettings(raw, ctx);
	if (asString(raw.type) === "block_action" && action === "kit_show") {
		await ctx.kv.delete(KIT_DONE);
		return renderInsights(ctx, undefined, guestWrites);
	}
	if (asString(raw.type) === "block_action" && asString(raw.action_id) === "kit_done") {
		await ctx.kv.set(KIT_DONE, "1");
		return renderInsights(ctx, { toast: { message: "Noted. The setup card is now one line with the guide.", type: "success" } }, guestWrites);
	}
	if (page.includes("settings")) return renderSettings(ctx);
	// Opening Insights starts Top searches at the first page with no find text.
	if (asString(raw.type) === "page_load") await ctx.kv.delete("view:top");
	return renderInsights(ctx, undefined, guestWrites);
}
