// Must load before anything that starts the test host: it patches the bridge the host uses.
import { MAX_BRIDGE_CALLS, countBridgeCalls } from "./bridge-count";

import { afterEach, describe, expect, it } from "vitest";

import { admin as adminUser, ana, guest, openSite, withCategories, withDocs } from "./site";

/**
 * Bridge calls per entry point, each in its worst realistic case (a busy help centre whose data
 * came from 0.1.5). On Cloudflare a sandboxed call gets 10 subrequests and each bridge call is one.
 * Every entry must stay at MAX_BRIDGE_CALLS or fewer; the exact counts are pinned so a change in
 * any of them is seen.
 */
const MEASURED: Record<string, number> = {
	"route health (1000 articles)": 3,
	"hook page:metadata (help article)": 1,
	"route config": 1,
	"route products (12 categories)": 2,
	"route log_search (new term, log full)": 9,
	"route log_search (new term, log full, first search of the day)": 8,
	"route log_search (new term, no site record yet)": 7,
	"route log_search (known term)": 6,
	"route log_search (first guest on the site)": 8,
	"route tally (500 votes, first read)": 8,
	"route tally (counted)": 1,
	"route tally (title older than a day)": 4,
	"route helpful (guest, No with comment)": 9,
	"route helpful (first guest on the site)": 8,
	"route helpful (article not counted yet)": 8,
	"route helpful_member (change vote)": 9,
	"admin page_load /insights (0.1.5 data, worst step)": 7,
	"admin page_load /insights (0.1.5 votes, no searches, worst step)": 7,
	"admin page_load /insights (busy, counted)": 7,
	"admin page_load /insights (new site, nothing to bring over)": 8,
	"admin block_action kit_done (busy)": 8,
	"admin block_action kit_show (busy)": 8,
	"admin page_load /searches (busy)": 5,
	"admin widget insights (busy)": 2,
	"admin top_find (busy)": 6,
	"admin top_page (busy)": 6,
	"admin top_prev (busy)": 6,
	"admin top_first (busy)": 6,
	"admin page_load /settings (12 categories)": 4,
	"admin form_submit save_feedback": 5,
	"admin form_submit save_contact": 5,
	"admin form_submit save_search": 5,
	"admin form_submit save_icons (12 categories)": 5,
};

/** Entries over MAX_BRIDGE_CALLS. Empty since 0.2.0, and the budget test keeps it that way. */
const KNOWN_OVER: Array<[string, number]> = [];

const seen = new Map<string, string[]>();

type Site = Awaited<ReturnType<typeof openSite>>;
let site: Site | undefined;
afterEach(async () => {
	await site?.dispose();
	site = undefined;
});

const DAY = 24 * 60 * 60 * 1000;
const RECENT = new Date(Date.now() - DAY).toISOString();

type Busy = { articles?: number; faqs?: number; categories?: number; votes?: boolean; searches?: number; legacyDays?: boolean };

/**
 * A busy help centre: published articles and FAQs, top-level categories with icons, 600 votes
 * over 30 articles (15 of them weak, 20 commented), and a search log with empty searches. All of it
 * in the 0.1.5 shape: vote rows with no stored counts, and 0.1.5 day counters in kv.
 */
async function busySite(opts: Busy = {}) {
	site = await openSite();
	const { rt } = site;
	const { ids } = await withDocs(
		rt,
		Array.from({ length: opts.articles ?? 0 }, (_, i) => ({ title: `Article ${i}`, slug: `article-${i}` })),
	);
	for (let i = 0; i < (opts.faqs ?? 0); i += 1) {
		await rt.fixtures.content("faq", { data: { title: `Question ${i}` }, slug: `question-${i}`, status: "published" } as never);
	}
	if (opts.categories) {
		const { terms } = await withCategories(
			rt,
			Array.from({ length: opts.categories }, (_, i) => ({ slug: `product-${i}`, label: `Product ${i}` })),
		);
		for (const term of terms) await rt.fixtures.plugin.storage("product_icons", term.id, { slug: term.slug, label: term.label, icon: "rocket" });
	}
	if (opts.votes) {
		for (let d = 0; d < 30; d += 1) {
			const doc = ids[d]!;
			for (let v = 0; v < 20; v += 1) {
				// Docs 0-14 are weak (more No than Yes). The newest row on docs 10-29 carries a comment.
				const helpful = d < 15 ? v < 5 : v < 15;
				const commented = d >= 10 && v === 19 && !helpful;
				await rt.fixtures.plugin.storage("feedback", `${doc}:w${v}`, {
					doc,
					doc_helpful: `${doc}:${helpful ? "yes" : "no"}`,
					helpful,
					comment: commented ? "Did not help" : "",
					visitor: `w${v}`,
					createdAt: new Date(Date.now() - (d * 20 + (19 - v)) * 60_000).toISOString(),
				});
			}
		}
	}
	for (let i = 0; i < (opts.searches ?? 0); i += 1) {
		const empty = i % 2 === 0;
		const term = `term ${String(i).padStart(5, "0")}`;
		await rt.fixtures.plugin.storage("searches", term, {
			term,
			count: 1 + (i % 7),
			empty: empty ? 1 : 0,
			found: !empty,
			lastAt: RECENT,
			...(empty ? { lastEmptyAt: RECENT } : {}),
		});
	}
	if (opts.legacyDays) {
		for (let d = 0; d < 20; d += 1) await rt.fixtures.plugin.kv(`day:${new Date(Date.now() - d * DAY).toISOString().slice(0, 10)}`, `${10 + d}|${d % 3}`);
	}
	return { site, rt, ids };
}

async function measure(name: string, call: () => Promise<unknown>) {
	const { result, calls } = await countBridgeCalls(call);
	seen.set(name, calls);
	const want = MEASURED[name];
	expect(want, `${name} has no MEASURED count`).toBeTypeOf("number");
	expect(calls.length, `${name}: ${calls.join(", ")}`).toBe(want);
	expect(calls.length, name).toBeLessThanOrEqual(MAX_BRIDGE_CALLS);
	return result;
}

/** Run calls until `done` says so, and record the largest. Each must fit on its own. */
async function measureSteps(name: string, call: () => Promise<unknown>, done: (result: unknown) => boolean, max = 40) {
	let worst: string[] = [];
	for (let i = 0; i < max; i += 1) {
		const { result, calls } = await countBridgeCalls(call);
		expect(calls.length, `${name}, step ${i + 1}: ${calls.join(", ")}`).toBeLessThanOrEqual(MAX_BRIDGE_CALLS);
		if (calls.length > worst.length) worst = calls;
		if (done(result)) {
			seen.set(name, worst);
			expect(worst.length, name).toBe(MEASURED[name]);
			return result;
		}
	}
	throw new Error(`${name} did not finish in ${max} steps`);
}

const text = (result: unknown) => JSON.stringify(result);
/** Insights is past its upgrade progress card and shows the full page. */
const fullInsights = (result: unknown) => text(result).includes('"label":"Helpful rate"');
const seedSalt = (s: Site) => s.rt.fixtures.plugin.kv("visitor_salt", "busy-site-salt");

const adminCall = (s: Site, input: Record<string, unknown>) => s.call("admin", input, { method: "POST", user: adminUser });
const fromGuest = guest("198.51.100.7");
/** A live site has its salt already. The first guest request on a site is measured on its own. */
const warmSalt = (s: Site) => seedSalt(s);

describe("hooks", () => {
	it("page:metadata on a help article", async () => {
		const { rt, ids } = await busySite({ articles: 1 });
		await measure("hook page:metadata (help article)", () =>
			rt.transport.invokeHook("page:metadata", {
				page: {
					url: "https://x.test/docs/article-0",
					path: "/docs/article-0",
					locale: null,
					kind: "content",
					pageType: "article",
					title: "Article 0",
					description: "d",
					canonical: "https://x.test/docs/article-0",
					image: null,
					content: { collection: "docs", id: ids[0], slug: "article-0" },
				},
			}),
		);
	});
});

describe("public routes", () => {
	it("health, 1000 articles", async () => {
		const { site: s } = await busySite({ articles: 1000 });
		const result = await measure("route health (1000 articles)", () => s.call("health", {}, { method: "GET" }));
		expect(result).toMatchObject({ articleCount: 100, articleCountMore: true });
	});

	it("config", async () => {
		const { site: s } = await busySite();
		await measure("route config", () => s.call("config", {}, { method: "GET" }));
	});

	it("products, 12 top-level categories", async () => {
		const { site: s } = await busySite({ categories: 12 });
		const result = await measure("route products (12 categories)", () => s.call("products", {}, { method: "GET" }));
		expect(text(result).match(/"icon":"rocket"/g)).toHaveLength(12);
	});

	it("log_search, a new term with the log at its 5000 cap", async () => {
		const { site: s } = await busySite({ searches: 5000 });
		await warmSalt(s);
		await s.call("log_search", { q: "warm up", found: 1 }, guest("203.0.113.9"));
		await measure("route log_search (new term, log full)", () => s.call("log_search", { q: "brand new", found: 0 }, fromGuest));
		// The trim ran in the same call: the log is back at its cap.
		expect((await s.rt.inspect.storage.list("searches")).length).toBeLessThanOrEqual(5000);
	});

	it("log_search, a new term with the log full on the first search of a day", async () => {
		const { site: s } = await busySite({ searches: 5000 });
		await warmSalt(s);
		const old: Record<string, unknown> = { since: RECENT, yes: 0, no: 0 };
		for (let i = 0; i < 16; i += 1) Object.assign(old, { [`d${i}`]: "2000-01-01", [`s${i}`]: 5, [`e${i}`]: 1 });
		await s.rt.fixtures.plugin.storage("stats", "site", old);
		await measure("route log_search (new term, log full, first search of the day)", () => s.call("log_search", { q: "brand new", found: 0 }, fromGuest));
		const week = text(await s.call("admin", { type: "page_load", page: "widget:insights" }, { method: "POST", user: adminUser }));
		expect(week).toContain("1 search found nothing this week");
	});

	it("log_search, a new term on a site with no counters yet", async () => {
		const { site: s } = await busySite({ searches: 5000 });
		await warmSalt(s);
		await measure("route log_search (new term, no site record yet)", () => s.call("log_search", { q: "brand new", found: 0 }, fromGuest));
	});

	it("log_search, a term already in the log", async () => {
		const { site: s } = await busySite({ searches: 10 });
		await warmSalt(s);
		await s.call("log_search", { q: "warm up", found: 1 }, guest("203.0.113.9"));
		await measure("route log_search (known term)", () => s.call("log_search", { q: "term 00000", found: 0 }, fromGuest));
	});

	it("log_search, the first guest on a site makes the salt", async () => {
		const { site: s } = await busySite({ searches: 10 });
		await measure("route log_search (first guest on the site)", () => s.call("log_search", { q: "term 00000", found: 0 }, fromGuest));
	});

	it("tally, article with 500 votes from 0.1.5, then counted, then a stale title", async () => {
		const { site: s, ids } = await busySite({ articles: 1 });
		for (let v = 0; v < 500; v += 1) {
			await s.rt.fixtures.plugin.storage("feedback", `${ids[0]}:x${v}`, { doc: ids[0], doc_helpful: `${ids[0]}:${v % 3 ? "yes" : "no"}`, helpful: v % 3 !== 0, comment: "", visitor: `x${v}`, createdAt: RECENT });
		}
		const first = await measure("route tally (500 votes, first read)", () => s.call("tally", { id: ids[0] }, { method: "GET" }));
		expect(first).toMatchObject({ ok: true, yes: 333, no: 167 });
		const again = await measure("route tally (counted)", () => s.call("tally", { id: ids[0] }, { method: "GET" }));
		expect(again).toMatchObject({ yes: 333, no: 167 });
		const row = await s.rt.inspect.storage.get<Record<string, unknown>>("article_votes", ids[0]!);
		await s.rt.fixtures.plugin.storage("article_votes", ids[0]!, { ...row, titledAt: "2000-01-01T00:00:00.000Z" });
		await measure("route tally (title older than a day)", () => s.call("tally", { id: ids[0] }, { method: "GET" }));
	});

	it("helpful, guest No vote with a comment", async () => {
		const { site: s, ids } = await busySite({ articles: 1 });
		await warmSalt(s);
		await s.call("tally", { id: ids[0] }, { method: "GET" });
		const result = await measure("route helpful (guest, No with comment)", () => s.call("helpful", { id: ids[0], helpful: false, comment: "Missing a step" }, fromGuest));
		expect(result).toMatchObject({ ok: true, yes: 0, no: 1 });
	});

	it("helpful, the first guest on a site makes the salt", async () => {
		const { site: s, ids } = await busySite({ articles: 1 });
		await s.call("tally", { id: ids[0] }, { method: "GET" });
		const result = await measure("route helpful (first guest on the site)", () => s.call("helpful", { id: ids[0], helpful: true }, fromGuest));
		expect(result).toMatchObject({ ok: true, yes: 1, no: 0 });
	});

	it("helpful, an article never read through tally: the vote is stored and tally counts it", async () => {
		const { site: s, ids } = await busySite({ articles: 1 });
		await warmSalt(s);
		const result = await measure("route helpful (article not counted yet)", () => s.call("helpful", { id: ids[0], helpful: true }, fromGuest));
		expect(result).toMatchObject({ ok: true });
		expect(await s.call("tally", { id: ids[0] }, { method: "GET" })).toMatchObject({ ok: true, yes: 1, no: 0 });
	});
});

describe("member routes", () => {
	it("helpful_member, changing a vote", async () => {
		const { site: s, ids } = await busySite({ articles: 1 });
		await warmSalt(s);
		await s.call("tally", { id: ids[0] }, { method: "GET" });
		await s.call("helpful_member", { id: ids[0], helpful: true }, { method: "POST", user: ana });
		const result = await measure("route helpful_member (change vote)", () =>
			s.call("helpful_member", { id: ids[0], helpful: false, comment: "Changed my mind" }, { method: "POST", user: ana }),
		);
		expect(result).toMatchObject({ ok: true, yes: 0, no: 1 });
	});
});

describe("admin", () => {
	const big: Busy = { articles: 300, faqs: 120, categories: 12, votes: true, searches: 600, legacyDays: true };
	const insights = (s: Site) => adminCall(s, { type: "page_load", page: "/insights" });
	/** The busy site with its 0.1.5 data already brought over. */
	async function counted() {
		const found = await busySite(big);
		for (let i = 0; i < 20 && !fullInsights(await insights(found.site)); i += 1);
		return found;
	}

	it("page_load /insights brings 0.1.5 data over a step at a time, every step within the budget", async () => {
		const { site: s } = await busySite(big);
		const done = await measureSteps("admin page_load /insights (0.1.5 data, worst step)", () => insights(s), fullInsights);
		const page = text(done);
		// 600 votes: docs 0-14 have 5 Yes, docs 15-29 have 15 Yes, out of 20 each.
		expect(page).toContain('"label":"Helpful rate","value":"50%"');
		expect(page).toContain("Least helpful articles");
		expect(page).toContain("Did not help");
		// The 0.1.5 day counters are in the chart: today was seeded with 10 searches.
		expect(page).toMatch(/"label":"Searches this week","value":"(\d+)"/);
		expect(page).not.toContain('"label":"Searches this week","value":"0"');
		const weak = (done as { blocks: Array<{ page_action_id?: string; rows?: unknown[] }> }).blocks.find((block) => block.page_action_id === "weak_page");
		expect(weak?.rows).toHaveLength(10);
	});

	it("page_load /insights on a 0.1.5 site with votes and no searches", async () => {
		const { site: s } = await busySite({ ...big, legacyDays: false, searches: 0 });
		await measureSteps("admin page_load /insights (0.1.5 votes, no searches, worst step)", () => insights(s), fullInsights);
	});

	it("page_load /insights once counted", async () => {
		const { site: s } = await counted();
		await measure("admin page_load /insights (busy, counted)", () => insights(s));
	});

	it("page_load /insights on a new site shows the full page at once", async () => {
		const { site: s } = await busySite({ articles: 300, faqs: 120, categories: 12 });
		const result = await measure("admin page_load /insights (new site, nothing to bring over)", () => insights(s));
		expect(fullInsights(result)).toBe(true);
	});

	it("page_load /searches", async () => {
		const { site: s } = await busySite(big);
		const result = await measure("admin page_load /searches (busy)", () => adminCall(s, { type: "page_load", page: "/searches" }));
		expect(text(result)).toContain("Searches with no results");
		expect(text(result)).toContain("Top searches");
	});

	it("widget insights", async () => {
		const { site: s } = await counted();
		const result = await measure("admin widget insights (busy)", () => adminCall(s, { type: "page_load", page: "widget:insights" }));
		expect(text(result)).toContain("Least helpful article: Article");
	});

	for (const action of ["top_find", "top_page", "top_prev", "top_first"]) {
		it(`block_action ${action}`, async () => {
			const { site: s } = await busySite(big);
			await measure(`admin ${action} (busy)`, () =>
				adminCall(s, {
					type: action === "top_find" ? "form_submit" : "block_action",
					action_id: action,
					page: "/searches",
					values: { find: "term" },
					value: { cursor: "" },
				}),
			);
		});
	}

	it("block_action kit_done sticks, and kit_show brings the card back", async () => {
		const { site: s } = await counted();
		expect(text(await insights(s))).toContain("Set up visitor pages");
		const done = await measure("admin block_action kit_done (busy)", () => adminCall(s, { type: "block_action", action_id: "kit_done", page: "/insights" }));
		expect(text(done)).not.toContain("Set up visitor pages");
		expect(fullInsights(done)).toBe(true);
		// A fresh load reads it back: the owner's "set up" stays.
		expect(text(await insights(s))).not.toContain("Set up visitor pages");
		const again = await measure("admin block_action kit_show (busy)", () => adminCall(s, { type: "block_action", action_id: "kit_show", page: "/insights" }));
		expect(text(again)).toContain("Set up visitor pages");
	});

	it("page_load /settings", async () => {
		const { site: s } = await busySite(big);
		await measure("admin page_load /settings (12 categories)", () => adminCall(s, { type: "page_load", page: "/settings" }));
	});

	it("form_submit save_feedback", async () => {
		const { site: s } = await busySite(big);
		await measure("admin form_submit save_feedback", () =>
			adminCall(s, { type: "form_submit", action_id: "save_feedback", page: "/settings", values: { ask_comment: true } }),
		);
	});

	it("form_submit save_contact", async () => {
		const { site: s } = await busySite(big);
		await measure("admin form_submit save_contact", () =>
			adminCall(s, { type: "form_submit", action_id: "save_contact", page: "/settings", values: { contact_url: "/contact" } }),
		);
	});

	it("form_submit save_search", async () => {
		const { site: s } = await busySite(big);
		await measure("admin form_submit save_search", () =>
			adminCall(s, { type: "form_submit", action_id: "save_search", page: "/settings", values: { search_collections: "docs,faq" } }),
		);
	});

	it("form_submit save_icons, 12 categories", async () => {
		const { site: s } = await busySite(big);
		const terms = (await s.rt.inspect.storage.list<{ slug: string }>("product_icons")).map((row) => row.id);
		const values = Object.fromEntries(terms.map((id) => [`icon__${id}`, "star"]));
		const result = await measure("admin form_submit save_icons (12 categories)", () =>
			adminCall(s, { type: "form_submit", action_id: "save_icons", page: "/settings", values }),
		);
		expect(text(result).match(/"initial_value":"star"/g)).toHaveLength(12);
	});
});

describe("budget", () => {
	it("measures every entry, and none is over the limit", () => {
		const over = [...seen].filter(([, calls]) => calls.length > MAX_BRIDGE_CALLS).map(([name, calls]) => [name, calls.length]);
		expect(over).toEqual(KNOWN_OVER);
		expect([...seen.keys()].sort()).toEqual(Object.keys(MEASURED).sort());
		for (const count of Object.values(MEASURED)) expect(count).toBeLessThanOrEqual(MAX_BRIDGE_CALLS);
	});
});
