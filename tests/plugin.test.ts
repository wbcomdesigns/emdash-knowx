import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error plain module shared with the lab seed
import { categoryTerms, docsCollection, faqCollection } from "../site-kit/seed/collection.mjs";
// @ts-expect-error plain module shared with the lab seed
import { docs, faqs } from "../site-kit/seed/articles.mjs";
import { openSite, withDocs, withPosts } from "./site";

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
	it("defines searchable docs and faq collections with 8 articles in 3 categories", () => {
		expect(docsCollection.supports).toContain("search");
		expect(faqCollection.supports).toContain("search");
		expect(docsCollection.fields.filter((field: { searchable?: boolean }) => field.searchable).map((field: { slug: string }) => field.slug)).toEqual([
			"title",
			"excerpt",
			"content",
		]);
		expect(docs).toHaveLength(8);
		expect(categoryTerms).toHaveLength(3);
		expect(new Set(docs.map((item: { taxonomies: { doc_category: string[] } }) => item.taxonomies.doc_category[0])).size).toBe(3);
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
		expect(body).toMatch(/No reports yet/);
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
