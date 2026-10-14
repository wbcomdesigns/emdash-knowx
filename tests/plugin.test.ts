import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error plain module shared with the lab seed
import { categoryTerms, docsCollection, faqCollection } from "../site-kit/seed/collection.mjs";
// @ts-expect-error plain module shared with the lab seed
import { docs, faqs } from "../site-kit/seed/articles.mjs";
import { openSite, withCategories, withDocs, withPosts } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

function texts(page: { blocks: Array<unknown> }): string {
	return page.blocks
		.map((block) => {
			const row = block as { text?: unknown; title?: unknown; description?: unknown };
			return [row.text, row.title, row.description].filter(Boolean).join(" ");
		})
		.join("\n");
}

describe("seed", () => {
	it("defines searchable docs and faq collections with 8 articles in 3 top-level categories", () => {
		expect(docsCollection.supports).toContain("search");
		expect(faqCollection.supports).toContain("search");
		expect(docsCollection.fields.filter((field: { searchable?: boolean }) => field.searchable).map((field: { slug: string }) => field.slug)).toEqual([
			"title",
			"excerpt",
			"content",
		]);
		expect(docs).toHaveLength(8);
		expect(categoryTerms.filter((term: { parent?: string }) => !term.parent)).toHaveLength(3);
		expect(categoryTerms.some((term: { slug: string; parent?: string }) => term.slug === "first-week" && term.parent === "getting-started")).toBe(true);
		expect(new Set(docs.map((item: { taxonomies: { doc_category: string[] } }) => item.taxonomies.doc_category[0])).size).toBe(4);
		expect(faqs.length).toBeGreaterThan(0);
	});
});

describe("health", () => {
	it("reports a missing collection", async () => {
		const site = await openSite();
		dispose = site.dispose;
		expect(await site.call("health")).toMatchObject({
			ok: true,
			collectionExists: false,
			articleCount: 0,
			faqCollectionExists: false,
		});
	});

	it("counts published help articles only", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [
			{ title: "Live one", slug: "live-one" },
			{ title: "Live two", slug: "live-two" },
			{ title: "Hidden draft", slug: "hidden-draft", status: "draft" },
		]);
		expect(await site.call("health")).toMatchObject({
			ok: true,
			collectionExists: true,
			articleCount: 2,
			faqCollectionExists: true,
		});
	});
});

describe("admin insights", () => {
	it("asks the owner to add the collection when it is missing", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const page = await site.rt.admin.loadPage("/insights");
		expect(texts(page)).toMatch(/Help articles are not set up/);
	});

	it("shows the published count when the collection exists", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		const page = await site.rt.admin.loadPage("/insights");
		const body = texts(page);
		expect(body).toMatch(/1 published help article/);
		expect(body).toMatch(/FAQ collection is ready/);
		expect(body).toMatch(/No weak articles yet/);
		expect(body).toMatch(/No comments yet/);
		expect(body).toMatch(/No searches yet/);
		expect(body).toMatch(/No empty searches yet/);
	});

	it("shows a clear message when the collection setting points at a missing type", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		await site.rt.fixtures.plugin.setting("collection", "no-such");
		expect(await site.call("health")).toMatchObject({
			ok: true,
			collectionExists: false,
			articleCount: 0,
		});
		expect(texts(await site.rt.admin.loadPage("/insights"))).toMatch(/Help articles are not set up/);
		expect(await site.call("config")).toMatchObject({ ok: true });
	});
});

describe("settings", () => {
	it("lists content types by name and saves each group", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		await withPosts(site.rt);
		const page = JSON.stringify(await site.rt.admin.loadPage("/settings"));
		expect(page).toContain("Help articles");
		expect(page).toContain("Posts");
		expect(page).not.toMatch(/"label":"docs"/);
		expect(page).toContain("Ask for a comment after a No vote");
		expect((await site.rt.admin.loadPage("/insights")).blocks.map((block) => block.type)).not.toContain("form");

		const admin = (input: Record<string, unknown>) => site.call("admin", input);
		const contact = await admin({
			type: "form_submit",
			action_id: "save_contact",
			page: "/settings",
			values: { contact_url: "mailto:help@example.com" },
		});
		expect(contact).toMatchObject({ toast: { type: "success" } });
		const refused = await admin({
			type: "form_submit",
			action_id: "save_contact",
			page: "/settings",
			values: { contact_url: "javascript:alert(1)" },
		});
		expect(refused).toMatchObject({ toast: { type: "error" } });
		const again = JSON.stringify(await site.rt.admin.loadPage("/settings"));
		expect(again).toContain("mailto:help@example.com");
		expect(again).not.toContain("javascript:");

		const search = await admin({
			type: "form_submit",
			action_id: "save_search",
			page: "/settings",
			values: { search_collections: ["docs", "posts"] },
		});
		expect(search).toMatchObject({ toast: { type: "success" } });
		expect(await site.call("config")).toMatchObject({ searchCollections: ["docs", "posts"] });

		const withUnknown = await admin({
			type: "form_submit",
			action_id: "save_search",
			page: "/settings",
			values: { search_collections: ["docs", "no-such-type"] },
		});
		expect(withUnknown).toMatchObject({ toast: { type: "success" } });
		expect(await site.call("config")).toMatchObject({ searchCollections: ["docs"] });
		const docsOnly = (await site.call("config")) as { searchCollections: string[] };
		expect(docsOnly.searchCollections).not.toContain("posts");

		const onlyUnknown = await admin({
			type: "form_submit",
			action_id: "save_search",
			page: "/settings",
			values: { search_collections: ["no-such-type"] },
		});
		expect(onlyUnknown).toMatchObject({ toast: { type: "error" } });
		expect(await site.call("config")).toMatchObject({ searchCollections: ["docs"] });

		const tooMany = await admin({
			type: "form_submit",
			action_id: "save_search",
			page: "/settings",
			values: { search_collections: ["a", "b", "c", "d", "e", "f"] },
		});
		expect(tooMany).toMatchObject({ toast: { type: "error" } });
	});
});

describe("page metadata", () => {
	it("adds article and breadcrumb data for a help article only", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		const page = {
			page: {
				url: "https://x.test/docs/welcome",
				path: "/docs/welcome",
				locale: null,
				kind: "content",
				pageType: "article",
				title: "Welcome",
				description: "Start here",
				canonical: "https://x.test/docs/welcome",
				image: null,
				content: { collection: "docs", id: ids[0], slug: "welcome" },
			},
		};
		const meta = await site.rt.transport.invokeHook("page:metadata", page);
		expect(meta).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "jsonld",
					graph: expect.objectContaining({ "@type": "Article", headline: "Welcome" }),
				}),
				expect.objectContaining({
					kind: "jsonld",
					graph: expect.objectContaining({ "@type": "BreadcrumbList" }),
				}),
			]),
		);
		expect(
			await site.rt.transport.invokeHook("page:metadata", {
				page: { ...page.page, content: { collection: "posts", id: "x", slug: "x" } },
			}),
		).toBeNull();
	});
});

describe("products", () => {
	it("hides the product layer for one category and shows names, not ids, when saving icons", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		const one = await withCategories(site.rt, [{ slug: "getting-started", label: "Getting started", description: "First steps" }]);
		const single = (await site.call("products")) as { items: unknown[]; productLayer: boolean };
		expect(single.productLayer).toBe(false);
		expect(single.items).toHaveLength(1);

		await site.rt.fixtures.taxonomy({
			name: "doc_category",
			slug: "billing",
			label: "Account and billing",
			data: { description: "Plans" },
		});
		const page = JSON.stringify(await site.rt.admin.loadPage("/settings"));
		expect(page).toContain('"label":"Getting started"');
		expect(page).toContain('"label":"Account and billing"');
		expect(page).not.toContain(`"label":"${one.terms[0].id}"`);

		const saved = await site.call("admin", {
			type: "form_submit",
			action_id: "save_icons",
			page: "/settings",
			values: { [`icon__${one.terms[0].id}`]: "rocket" },
		});
		expect(saved).toMatchObject({ toast: { type: "success" } });
		const products = (await site.call("products")) as { items: Array<{ label: string; icon: string }>; productLayer: boolean };
		expect(products.productLayer).toBe(true);
		expect(products.items.find((item) => item.label === "Getting started")?.icon).toBe("rocket");

		const refused = await site.call("admin", {
			type: "form_submit",
			action_id: "save_icons",
			page: "/settings",
			values: { [`icon__${one.terms[0].id}`]: "<script>alert(1)</script>" },
		});
		expect(refused).toMatchObject({ toast: { type: "error" } });
	});
});

describe("config", () => {
	it("returns contact, comment and search coverage without term ids", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt);
		expect(await site.call("config")).toMatchObject({
			ok: true,
			searchCollections: ["docs"],
			askComment: true,
			contactUrl: "",
		});
		await site.call("admin", {
			type: "form_submit",
			action_id: "save_contact",
			page: "/settings",
			values: { contact_url: "/contact" },
		});
		expect(await site.call("config")).toMatchObject({ ok: true, contactUrl: "/contact" });
	});
});

describe("search log", () => {
	it("counts a term, skips an email and a honeypot, and lists them on Insights", async () => {
		const site = await openSite();
		dispose = site.dispose;
		await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		expect(await site.call("log_search", { q: "billing plan", found: 2, vid: "v1" })).toMatchObject({ ok: true });
		expect(await site.call("log_search", { q: "billing plan", found: 0, vid: "v1" })).toMatchObject({ ok: true });
		expect(await site.call("log_search", { q: "help@example.com", found: 0, vid: "v1" })).toMatchObject({ ok: true });
		expect(await site.call("log_search", { q: "secret-spam", found: 0, website: "http://x", vid: "v1" })).toMatchObject({
			ok: true,
		});
		const page = JSON.stringify(await site.rt.admin.loadPage("/insights"));
		expect(page).toContain("billing plan");
		expect(page).toContain('"times":"2"');
		expect(page).not.toContain("help@example.com");
		expect(page).not.toContain("secret-spam");
	});
});

describe("helpful", () => {
	it("saves one vote per visitor, moves it on a second click, and names the article on Insights", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		const missing = await site.call("helpful", { helpful: true, vid: "v1" });
		expect(missing).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
		const gone = await site.call("helpful", { id: "missing", helpful: true, vid: "v1" });
		expect(gone).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

		const yes = await site.call("helpful", { id: ids[0], helpful: true, vid: "v1" });
		expect(yes).toMatchObject({ ok: true, yes: 1, no: 0 });
		const flipped = await site.call("helpful", { id: ids[0], helpful: false, comment: "Missing steps", vid: "v1" });
		expect(flipped).toMatchObject({ ok: true, yes: 0, no: 1 });
		const other = await site.call("helpful", { id: ids[0], helpful: false, comment: "Still unclear", vid: "v2" });
		expect(other).toMatchObject({ ok: true, yes: 0, no: 2 });
		expect(await site.call("tally", { id: ids[0] })).toMatchObject({ ok: true, yes: 0, no: 2 });

		const page = JSON.stringify(await site.rt.admin.loadPage("/insights"));
		expect(page).toContain("Welcome");
		expect(page).toContain("Still unclear");
		expect(page).toContain("Missing steps");
		expect(page).not.toContain(ids[0]);
	});
});

describe("search labels", () => {
	it("names collections visitors see, including uppercase slugs from LiveSearch", async () => {
		const { kindLabel } = await import("../site-kit/lib/knowx-strings");
		expect(kindLabel("docs")).toBe("Help article");
		expect(kindLabel("DOCS")).toBe("Help article");
		expect(kindLabel("posts")).toBe("Post");
		expect(kindLabel("faq")).toBe("FAQ");
		expect(kindLabel("pages")).toBe("Page");
		expect(kindLabel("unknown")).toBe("unknown");
	});
});

describe("dashboard card", () => {
	it("names the weakest article and counts empty searches from this week", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		const empty = (await site.call("admin", { type: "page_load", page: "widget:insights" })) as {
			blocks: unknown[];
		};
		expect(texts(empty)).toMatch(/No empty searches this week/);
		expect(texts(empty)).toMatch(/No article has more No votes than Yes yet/);

		await site.call("helpful", { id: ids[0], helpful: false, comment: "Need steps", vid: "v1" });
		await site.call("log_search", { q: "refund policy", found: 0, vid: "v1" });
		const card = (await site.call("admin", { widget: "insights" })) as { blocks: unknown[] };
		expect(texts(card)).toMatch(/1 search found nothing this week/);
		expect(texts(card)).toMatch(/Least helpful article: Welcome/);
		expect(JSON.stringify(card)).not.toContain(ids[0]);
	});
});
