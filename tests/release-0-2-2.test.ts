import { afterEach, describe, expect, it } from "vitest";

import { openSite, withDocs } from "./site";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => {
	await dispose?.();
	dispose = undefined;
});

describe("0.2.2", () => {
	it("the manifest tells the registry the lowest EmDash it supports", async () => {
		// @ts-expect-error vite raw import
		const jsonc = String((await import("../emdash-plugin.jsonc?raw")).default);
		expect(jsonc).toMatch(/"release":\s*\{\s*"requires":\s*\{\s*"env:emdash":\s*">=1\.2\.0"\s*\}/);
	});

	it("a FAQ entry never gets a FAQPage without its questions, only its breadcrumbs", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const page = {
			url: "https://x.test/docs/faq/refunds",
			path: "/docs/faq/refunds",
			locale: null,
			kind: "content",
			pageType: "article",
			title: "Can I get a refund?",
			description: "Refunds",
			canonical: "https://x.test/docs/faq/refunds",
			image: null,
			content: { collection: "faq", id: "f1", slug: "refunds" },
		};
		const meta = (await site.rt.transport.invokeHook("page:metadata", { page })) as Array<{ graph: Record<string, unknown> }>;
		expect(JSON.stringify(meta)).not.toContain("FAQPage");
		expect(meta.map((m) => m.graph["@type"])).toEqual(["BreadcrumbList"]);

		// No breadcrumbs on the page either: nothing to add.
		expect(await site.rt.transport.invokeHook("page:metadata", { page: { ...page, breadcrumbs: [] } })).toBeNull();
	});

	it("a help article still gets its Article graph", async () => {
		const site = await openSite();
		dispose = site.dispose;
		const { ids } = await withDocs(site.rt, [{ title: "Welcome", slug: "welcome" }]);
		const meta = (await site.rt.transport.invokeHook("page:metadata", {
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
		})) as Array<{ graph: Record<string, unknown> }>;
		expect(meta.map((m) => m.graph["@type"])).toEqual(["Article", "BreadcrumbList"]);
	});
});
