import type { PluginContext } from "emdash/plugin";

import { budget, collectionStatus, FAQ, spend, type CollectionStatus } from "./core";
import { PRODUCT_ICONS, listTopLevelCategories, saveProductIcons, useProductLayer, type ProductCard } from "./products";
import { emptySearches, recentComments } from "./report";
import {
	KIT_DONE,
	listContentTypes,
	loadSettings,
	parseContactUrl,
	parseSearchCollections,
	SEARCH_COLLECTION_CAP,
	searchCollectionsSetting,
	type CollectionChoice,
	type KnowxSettings,
} from "./settings";
import { readStats, type SiteStats } from "./stats";
import { upgradeDone, upgradeFinished, upgradeStep, type Upgrade } from "./upgrade";
import { asBoolean, asRecord, asString } from "./util";
import { COUNTERS, counterOf, weakArticles, type Counter } from "./votes";

type Toast = { message: string; type: "success" | "error" | "info" };
export type BlockResponse = { blocks: Array<Record<string, unknown>>; toast?: Toast };
type Block = Record<string, unknown>;

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
 * "Done" is stored with the version (a setting, read with every other setting in one call), so the
 * card comes back after each update, when the kit has to be copied again. No call of its own.
 */
export function kitBlocks(ctx: PluginContext, settings: KnowxSettings): Block[] {
	const tag = `v${ctx.plugin.version}`;
	const guide = { type: "link", label: "Install guide", target: { kind: "external", url: guideUrl(ctx) } };
	if (settings.kitDone === ctx.plugin.version) {
		return [
			{ type: "context", text: `Visitor pages come from the KnowX site kit. After each plugin update, copy the kit for the new version again.` },
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
		{
			type: "context",
			text: `From your site's root folder, run this command. It copies the kit for the version you have installed (${tag}). On a site whose database is a local SQLite file it also creates the Help articles and FAQs content types; on any other site (Cloudflare D1, for example) create them in the admin as the install guide shows. Run it again after each update.`,
		},
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
function guestBlocks(ctx: PluginContext, guestWrites: boolean): Block[] {
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

const searchesLink = (label = "Open Searches") => ({ type: "link", label, target: { kind: "plugin-page", path: "/searches" } });

/**
 * Insights. Call budget (Cloudflare, 9): the settings (one call, done by the caller), the content
 * types and one page of articles, then either the FAQ check (no articles yet) or the site record,
 * the least helpful articles and the recent comments, and at most one read for comment titles.
 * Six calls after the settings, so an action that writes one setting first still fits. Top
 * searches and searches with no results are on their own page (Searches).
 *
 * `step`: run one step of bringing 0.1.x data over (page loads only, until it is finished). A step
 * that found work shows its progress instead of the page; the next load continues. One that found
 * none leaves the page five calls (see upgradeStep).
 */
export async function renderInsights(
	ctx: PluginContext,
	settings: KnowxSettings,
	used: number,
	opts: { toast?: Toast; guestWrites?: boolean; step?: boolean } = {},
): Promise<BlockResponse> {
	const top: Block[] = [{ type: "header", text: "Insights" }, ...kitBlocks(ctx, settings), ...guestBlocks(ctx, opts.guestWrites !== false)];
	let state: Upgrade | null = null;
	if (opts.step && !upgradeFinished(settings)) {
		const result = await upgradeStep(ctx, used, settings.collection);
		if (result.worked) return { blocks: [...top, ...upgradeBlocks(result.state)], toast: opts.toast };
		used = result.used;
		state = result.state;
	}
	const b = budget(used);
	spend(b, 2);
	const status = await collectionStatus(ctx, settings.collection);
	if (!status.collectionExists) {
		return {
			blocks: [
				...top,
				{
					type: "empty",
					title: "Help articles are not set up",
					description:
						"Copy the kit with the command above. On a site with a local SQLite database it creates the Help articles and FAQs content types; on any other site create them in the admin as the install guide shows. Then add your first article in Content, Help articles.",
				},
			],
			toast: opts.toast,
		};
	}
	const firstSteps: Block[] = [];
	let stats: SiteStats | null = null;
	let weak: Counter[] | null = null;
	let comments: Array<{ article: string; comment: string }> | null = null;
	if (status.articleCount === 0) {
		firstSteps.push({
			type: "empty",
			title: "Add your first help article",
			description: `In the admin menu open Content, ${status.articleLabel}, and choose Add New. Publish it and it shows on /docs/.`,
		});
		firstSteps.push(...(await faqSteps(ctx, b, status)));
	} else if (!status.faqCollectionExists) {
		firstSteps.push(...(await faqSteps(ctx, b, status)));
	}
	spend(b);
	stats = await readStats(ctx).catch(() => null);
	// No published article, no vote to show: the two vote tables keep their empty states.
	if (status.articleCount > 0) {
		spend(b, 2);
		weak = await weakArticles(ctx, 10, status.titles).catch(() => null);
		comments = await commentRows(ctx, b, status, weak ?? []).catch(() => null);
	}
	const progress = !state?.counted || upgradeDone(state) ? [] : [{ type: "context", text: `Votes from KnowX 0.1 are still being counted (${state.counted} so far). Each time Insights opens it counts more.` }];
	return {
		blocks: [...top, ...progress, ...firstSteps, insightStats(status, stats), ...voteBlocks(weak, comments, status.articleCount > 0), ...searchBlocks()],
		toast: opts.toast,
	};
}

/** The FAQ first step. One call only when the FAQ type exists and articles are not yet written. */
async function faqSteps(ctx: PluginContext, b: ReturnType<typeof budget>, status: CollectionStatus): Promise<Block[]> {
	if (!status.faqCollectionExists) {
		return [
			{
				type: "empty",
				title: "The FAQ collection is not set up yet",
				description:
					"Copy the kit again: on a site with a local SQLite database it creates the FAQs content type and leaves your articles alone. On any other site create it in the admin as the install guide shows.",
			},
		];
	}
	spend(b);
	const page = await ctx.content?.list(FAQ, { limit: 1, where: { status: "published" } }).catch(() => null);
	if (page?.items.length) return [];
	return [
		{
			type: "empty",
			title: "Add your first FAQ",
			description: `In the admin menu open Content, ${status.faqLabel}, and choose Add New. Published questions show on /docs/faq/.`,
		},
	];
}

/** Progress of bringing 0.1.x data over, shown instead of the page while a step found work. */
function upgradeBlocks(state: Upgrade): Block[] {
	const done = upgradeDone(state);
	return [
		{
			type: "empty",
			title: done ? "Insights is ready" : "Bringing over data from KnowX 0.1",
			description: done
				? `Votes and search counts from before the update are counted (${state.counted} votes).`
				: state.votes
					? `${state.counted} votes from before the update are counted. Now naming the articles they belong to, 200 articles at a time.`
					: `Votes and search counts from before the update are counted a step at a time, because each request may do only a little work. ${state.counted} votes so far.`,
		},
		{
			type: "actions",
			elements: [{ type: "button", action_id: "upgrade_step", label: done ? "Show Insights" : "Continue", style: "primary" }],
		},
	];
}

/**
 * Comment rows with the article named. A 0.2.0 comment carries its title; an older one is named
 * from the least helpful list, the page of articles already read, or one read of the stored counts.
 */
async function commentRows(ctx: PluginContext, b: ReturnType<typeof budget>, status: CollectionStatus, weak: Counter[]) {
	const found = await recentComments(ctx);
	const names = new Map<string, string>([...status.titles]);
	for (const row of weak) if (row.title) names.set(row.doc, row.title);
	const unknown = [...new Set(found.filter((row) => !row.title && !names.get(row.doc)).map((row) => row.doc))];
	if (unknown.length && spend(b)) {
		const stored = await ctx.storage[COUNTERS].getMany(unknown).catch(() => new Map());
		for (const [id, raw] of stored) {
			const title = counterOf(id, raw)?.title;
			if (title) names.set(id, title);
		}
	}
	return found.map((row) => ({ article: row.title || names.get(row.doc) || "Help article", comment: row.comment }));
}

function insightStats(status: CollectionStatus, stats: SiteStats | null): Block {
	const week = stats?.days.slice(-7) ?? [];
	const searches = week.reduce((sum, day) => sum + day.searches, 0);
	const empty = week.reduce((sum, day) => sum + day.empty, 0);
	const votes = (stats?.yes ?? 0) + (stats?.no ?? 0);
	const rate = stats && votes ? `${Math.round((stats.yes / votes) * 100)}%` : "None yet";
	return {
		type: "columns",
		columns: [
			[
				{
					type: "stats",
					items: [
						{ label: "Articles", value: status.articleMore ? `${status.articleCount}+` : String(status.articleCount) },
						{ label: "Searches this week", value: String(searches) },
						{ label: "Searches with no results", value: String(empty) },
						{ label: "Helpful rate", value: rate },
					],
				},
			],
			[
				{
					type: "chart",
					config: {
						chart_type: "timeseries",
						series: [{ name: "Searches", data: (stats?.days ?? []).map((day) => [day.day, day.searches]) }],
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

function voteBlocks(weak: Counter[] | null, comments: Array<{ article: string; comment: string }> | null, read: boolean): Block[] {
	if (read && (!weak || !comments)) return [{ type: "empty", title: "Helpfulness could not be loaded", description: "Try again in a moment." }];
	weak ??= [];
	comments ??= [];
	const weakRows = weak.map((row) => ({ article: row.title, no: String(row.no), yes: String(row.yes) }));
	return [
		{ type: "header", text: "Least helpful articles" },
		weakRows.length
			? { type: "table", page_action_id: "weak_page", columns: cols("article", "no", "yes"), rows: weakRows }
			: { type: "empty", title: "No weak articles yet", description: "A No vote that outnumbers Yes will show here." },
		{ type: "header", text: "Recent comments" },
		comments.length
			? { type: "table", page_action_id: "comments_page", columns: cols("article", "comment"), rows: comments }
			: { type: "empty", title: "No comments yet", description: "Comments after a No vote show here as plain text." },
	];
}

function searchBlocks(): Block[] {
	return [
		{ type: "header", text: "Searches" },
		{ type: "context", text: "Top searches and searches with no results are on the Searches page." },
		{ type: "actions", elements: [searchesLink()] },
	];
}

const TOP_PAGE = 25;

/** Top searches: 25 at a time by count, with find by the start of the term. */
type TopView = { find: string; cursor?: string; page?: number };

/**
 * Searches page: Top searches and Searches with no results. Four calls (two for each table), so
 * paging with its saved view (two more) fits.
 */
export async function renderSearches(ctx: PluginContext, view: TopView = { find: "" }, guestWrites = true): Promise<BlockResponse> {
	const blocks: Block[] = [{ type: "header", text: "Searches" }, ...guestBlocks(ctx, guestWrites)];
	try {
		blocks.push(...(await topSearchBlocks(ctx, view)));
	} catch {
		blocks.push({ type: "empty", title: "Top searches could not be loaded", description: "Try again in a moment." });
	}
	try {
		const empty = (await emptySearches(ctx)).map((item) => ({ term: item.term, times: String(item.times) }));
		blocks.push({ type: "header", text: "Searches with no results" });
		blocks.push(
			empty.length
				? { type: "table", page_action_id: "empty_page", columns: cols("term", "times"), rows: empty }
				: { type: "empty", title: "No empty searches yet", description: "A search that found nothing in the last 30 days shows here." },
		);
	} catch {
		blocks.push({ type: "empty", title: "Searches with no results could not be loaded", description: "Try again in a moment." });
	}
	return { blocks };
}

async function topSearchBlocks(ctx: PluginContext, view: TopView): Promise<Block[]> {
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
	const blocks: Block[] = [
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

function cols(...keys: string[]) {
	return keys.map((key) => ({
		key,
		label: key === "no" ? "No" : key === "yes" ? "Yes" : key[0].toUpperCase() + key.slice(1),
	}));
}

/** What the Settings page is built from. Four calls: settings, content types, categories, icons. */
type SettingsView = { settings: KnowxSettings; types: CollectionChoice[]; products: ProductCard[] };

async function loadSettingsView(ctx: PluginContext): Promise<SettingsView> {
	const settings = await loadSettings(ctx);
	const types = await listContentTypes(ctx);
	const products = await listTopLevelCategories(ctx);
	return { settings, types, products };
}

export function renderSettings(view: SettingsView, extra?: Pick<BlockResponse, "toast">): BlockResponse {
	const { settings, types, products } = view;
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

/**
 * Settings saves. Call budget (Cloudflare, 9): the four reads the page is built from, done once,
 * then one write. The page after the save is built from the same reads with the change applied.
 */
async function saveSettings(input: Record<string, unknown>, ctx: PluginContext): Promise<BlockResponse> {
	const action = asString(input.action_id);
	const values = asRecord(input.values);
	const view = await loadSettingsView(ctx);
	const saved = (message: string) => renderSettings(view, { toast: { message, type: "success" } });
	const refused = (message: string) => renderSettings(view, { toast: { message, type: "error" } });

	if (action === "save_feedback") {
		const ask = asBoolean(values.ask_comment);
		await ctx.settings.set("ask_comment", ask);
		view.settings = { ...view.settings, askComment: ask };
		return saved("Feedback setting saved.");
	}

	if (action === "save_contact") {
		const parsed = parseContactUrl(values.contact_url);
		if (!parsed.ok) {
			return refused("Use a page path, an http(s) link, or a mailto address. Nothing was changed.");
		}
		await ctx.settings.set("contact_url", parsed.value);
		view.settings = { ...view.settings, contactUrl: parsed.value };
		return saved(parsed.value ? "Contact link saved." : "Contact link cleared. The prompt is hidden.");
	}

	if (action === "save_search") {
		const parsed = parseSearchCollections(values.search_collections, view.settings.collection);
		if (!parsed.ok) return refused(parsed.reason);
		const known = new Set(view.types.map((item) => item.slug));
		const value = parsed.value.filter((slug) => known.has(slug));
		if (!value.length) return refused("Tick at least one content type that exists on this site.");
		await ctx.settings.set("search_collections", searchCollectionsSetting(value));
		view.settings = { ...view.settings, searchCollections: value };
		return saved("Search coverage saved.");
	}

	if (action === "save_icons") {
		const count = await saveProductIcons(ctx, view.products, values);
		if (!count) return refused("Pick an icon from the list. Nothing was changed.");
		view.products = view.products.map((item) => {
			const icon = asString(values[`icon__${item.id}`]);
			return PRODUCT_ICONS.some((choice) => choice.slug === icon) ? { ...item, icon } : item;
		});
		return saved("Product icons saved.");
	}

	return renderSettings(view);
}

/**
 * Card on the EmDash dashboard: empty searches this week, and the least helpful article. Two
 * calls: the site record and the top of the least helpful list (each row carries its title).
 */
export async function renderDashboard(ctx: PluginContext): Promise<BlockResponse> {
	let emptyThisWeek = 0;
	try {
		emptyThisWeek = (await readStats(ctx)).days.slice(-7).reduce((sum, day) => sum + day.empty, 0);
	} catch {
		emptyThisWeek = 0;
	}

	let weakest = "";
	try {
		const worst = (await weakArticles(ctx, 1))[0];
		if (worst) weakest = worst.title;
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
				elements: [
					{ type: "link", label: "Open Insights", target: { kind: "plugin-page", path: "/insights" } },
					searchesLink(),
				],
			},
		],
	};
}

const TOP_ACTIONS = new Set(["top_find", "top_page", "top_prev", "top_first"]);

export async function handleAdmin(input: unknown, ctx: PluginContext, guestWrites = true): Promise<BlockResponse> {
	const raw = asRecord(input);
	const page = asString(raw.page);
	const type = asString(raw.type);
	const action = asString(raw.action_id);
	if (asString(raw.widget) === "insights" || page.includes("widget:insights")) return renderDashboard(ctx);
	// Top searches: Find and paging keep the find text and the cursors of the pages shown so far in
	// kv, so Previous page and First page can go back. Opening Searches starts fresh.
	if (TOP_ACTIONS.has(action)) {
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
		return renderSearches(ctx, { find, cursor, page: pages.length }, guestWrites);
	}
	if (page.includes("searches")) {
		if (type === "page_load") await ctx.kv.delete("view:top");
		return renderSearches(ctx, { find: "" }, guestWrites);
	}
	if (type === "form_submit") return saveSettings(raw, ctx);
	if (page.includes("settings")) return renderSettings(await loadSettingsView(ctx));
	const settings = await loadSettings(ctx);
	// Insights actions write one setting, then render with it applied: two calls before the page.
	if (type === "block_action" && action === "kit_show") {
		await ctx.settings.delete(KIT_DONE);
		return renderInsights(ctx, { ...settings, kitDone: "" }, 2, { guestWrites });
	}
	if (type === "block_action" && action === "kit_done") {
		await ctx.settings.set(KIT_DONE, ctx.plugin.version);
		return renderInsights(ctx, { ...settings, kitDone: ctx.plugin.version }, 2, {
			guestWrites,
			toast: { message: "Noted. The setup card is now one line with the guide.", type: "success" },
		});
	}
	// Opening Insights (or Continue on its progress card) runs one step of bringing 0.1.x data over.
	return renderInsights(ctx, settings, 1, { guestWrites, step: type === "page_load" || action === "upgrade_step" });
}

