import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error plain module shared with the lab seed
import { categoryTerms, docsCollection, faqCollection } from "../site-kit/seed/collection.mjs";
// @ts-expect-error plain module shared with the lab seed
import { docs, faqs } from "../site-kit/seed/articles.mjs";
import { openSite, withDocs } from "./site";

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
