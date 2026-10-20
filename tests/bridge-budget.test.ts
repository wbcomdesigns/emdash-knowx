// Must load before anything that starts the test host: it patches the bridge the host uses.
import { MAX_BRIDGE_CALLS, countBridgeCalls } from "./bridge-count";

import { afterEach, describe, expect, it } from "vitest";

import { admin as adminUser, ana, guest, openSite, withCategories, withDocs } from "./site";

/**
 * Bridge calls per entry point, each in its worst realistic case (a busy help centre). On
 * Cloudflare a sandboxed call gets 10 subrequests and each bridge call is one. This file
 * measures; it does not enforce the limit yet. A change in any count fails here so it is seen.
 */
const MEASURED: Record<string, number> = {
	"route health (1000 articles)": 12,
	"hook page:metadata (help article)": 1,
	"route config": 4,
	"route products (12 categories)": 13,
	"route log_search (new term, log full)": 11,
	"route log_search (known term)": 7,
	"route tally (500 votes)": 2,
	"route helpful (guest, No with comment)": 12,
	"route helpful_member (change vote)": 12,
	"admin page_load /insights (busy)": 98,
	"admin page_load /settings (12 categories)": 18,
	"admin widget insights (busy)": 15,
	"admin top_find (busy)": 99,
	"admin top_page (busy)": 99,
	"admin top_prev (busy)": 99,
	"admin top_first (busy)": 99,
	"admin block_action kit_show (busy)": 98,
	"admin block_action kit_done (busy)": 98,
	"admin form_submit save_feedback": 19,
	"admin form_submit save_contact": 19,
	"admin form_submit save_search": 24,
	"admin form_submit save_icons (12 categories)": 42,
};

/** Every entry over MAX_BRIDGE_CALLS, with its count. Must match what the run measures. */
const KNOWN_OVER: Array<[string, number]> = [
	["route health (1000 articles)", 12],
	["route products (12 categories)", 13],
	["route log_search (new term, log full)", 11],
	["route helpful (guest, No with comment)", 12],
	["route helpful_member (change vote)", 12],
	["admin page_load /insights (busy)", 98],
	["admin page_load /settings (12 categories)", 18],
	["admin widget insights (busy)", 15],
	["admin top_find (busy)", 99],
	["admin top_page (busy)", 99],
	["admin top_prev (busy)", 99],
	["admin top_first (busy)", 99],
	["admin block_action kit_show (busy)", 98],
	["admin block_action kit_done (busy)", 98],
	["admin form_submit save_feedback", 19],
	["admin form_submit save_contact", 19],
	["admin form_submit save_search", 24],
	["admin form_submit save_icons (12 categories)", 42],
];

const seen = new Map<string, string[]>();

type Site = Awaited<ReturnType<typeof openSite>>;
let site: Site | undefined;
afterEach(async () => {
	await site?.dispose();
	site = undefined;
});

const DAY = 24 * 60 * 60 * 1000;
const RECENT = new Date(Date.now() - DAY).toISOString();

type Busy = { articles?: number; faqs?: number; categories?: number; votes?: boolean; searches?: number };

/**
 * A busy help centre: published articles and FAQs, top-level categories with icons, 600 votes
 * over 30 articles (15 of them weak, 20 commented), and a search log with empty searches.
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
	return { site, rt, ids };
}

async function measure(name: string, call: () => Promise<unknown>) {
	const { result, calls } = await countBridgeCalls(call);
	seen.set(name, calls);
	const want = MEASURED[name];
	expect(want, `${name} has no MEASURED count`).toBeTypeOf("number");
	expect(calls.length, name).toBe(want);
	return result;
}

const adminCall = (s: Site, input: Record<string, unknown>) => s.call("admin", input, { method: "POST", user: adminUser });
const fromGuest = guest("198.51.100.7");
/** A live site has its salt already; a first guest request would add one more call. */
const warmSalt = (s: Site) => s.call("log_search", { q: "warm up", found: 1 }, guest("203.0.113.9"));

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
		await measure("route health (1000 articles)", () => s.call("health", {}, { method: "GET" }));
	});

	it("config", async () => {
		const { site: s } = await busySite();
		await measure("route config", () => s.call("config", {}, { method: "GET" }));
	});

	it("products, 12 top-level categories", async () => {
		const { site: s } = await busySite({ categories: 12 });
		await measure("route products (12 categories)", () => s.call("products", {}, { method: "GET" }));
	});

	it("log_search, a new term with the log at its 5000 cap", async () => {
		const { site: s } = await busySite({ searches: 5000 });
		await warmSalt(s);
		await measure("route log_search (new term, log full)", () => s.call("log_search", { q: "brand new", found: 0 }, fromGuest));
	});

	it("log_search, a term already in the log", async () => {
		const { site: s } = await busySite({ searches: 10 });
		await warmSalt(s);
		await measure("route log_search (known term)", () => s.call("log_search", { q: "term 00000", found: 0 }, fromGuest));
	});

	it("tally, article with 500 votes", async () => {
		const { site: s, ids } = await busySite({ articles: 1 });
		for (let v = 0; v < 500; v += 1) {
			await s.rt.fixtures.plugin.storage("feedback", `${ids[0]}:x${v}`, { doc: ids[0], doc_helpful: `${ids[0]}:${v % 3 ? "yes" : "no"}`, helpful: v % 3 !== 0, comment: "", visitor: `x${v}`, createdAt: RECENT });
		}
		await measure("route tally (500 votes)", () => s.call("tally", { id: ids[0] }, { method: "GET" }));
	});

	it("helpful, guest No vote with a comment", async () => {
		const { site: s, ids } = await busySite({ articles: 1 });
		await warmSalt(s);
		await measure("route helpful (guest, No with comment)", () => s.call("helpful", { id: ids[0], helpful: false, comment: "Missing a step" }, fromGuest));
	});
});

describe("member routes", () => {
	it("helpful_member, changing a vote", async () => {
		const { site: s, ids } = await busySite({ articles: 1 });
		await s.call("helpful_member", { id: ids[0], helpful: true }, { method: "POST", user: ana });
		await measure("route helpful_member (change vote)", () =>
			s.call("helpful_member", { id: ids[0], helpful: false, comment: "Changed my mind" }, { method: "POST", user: ana }),
		);
	});
});

describe("admin", () => {
	const big: Busy = { articles: 300, faqs: 120, categories: 12, votes: true, searches: 600 };

	it("page_load /insights", async () => {
		const { site: s } = await busySite(big);
		await measure("admin page_load /insights (busy)", () => adminCall(s, { type: "page_load", page: "/insights" }));
	});

	it("page_load /settings", async () => {
		const { site: s } = await busySite(big);
		await measure("admin page_load /settings (12 categories)", () => adminCall(s, { type: "page_load", page: "/settings" }));
	});

	it("widget insights", async () => {
		const { site: s } = await busySite(big);
		await measure("admin widget insights (busy)", () => adminCall(s, { type: "page_load", page: "widget:insights" }));
	});

	for (const action of ["top_find", "top_page", "top_prev", "top_first"]) {
		it(`block_action ${action}`, async () => {
			const { site: s } = await busySite(big);
			await measure(`admin ${action} (busy)`, () =>
				adminCall(s, {
					type: action === "top_find" ? "form_submit" : "block_action",
					action_id: action,
					page: "/insights",
					values: { find: "term" },
					value: { cursor: "" },
				}),
			);
		});
	}

	for (const action of ["kit_show", "kit_done"]) {
		it(`block_action ${action}`, async () => {
			const { site: s } = await busySite(big);
			await measure(`admin block_action ${action} (busy)`, () => adminCall(s, { type: "block_action", action_id: action, page: "/insights" }));
		});
	}

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
		await measure("admin form_submit save_icons (12 categories)", () =>
			adminCall(s, { type: "form_submit", action_id: "save_icons", page: "/settings", values }),
		);
	});
});

describe("budget", () => {
	it("lists every entry over the limit", () => {
		const over = [...seen].filter(([, calls]) => calls.length > MAX_BRIDGE_CALLS).map(([name]) => name);
		expect(over.sort()).toEqual(KNOWN_OVER.map(([name]) => name).sort());
		for (const [name, count] of KNOWN_OVER) expect(MEASURED[name], name).toBe(count);
		// Every measured entry has a recorded count.
		expect([...seen.keys()].sort()).toEqual(Object.keys(MEASURED).sort());
	});
});
