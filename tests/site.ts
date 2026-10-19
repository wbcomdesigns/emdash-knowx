import { createPluginRuntimeTestHost } from "@emdash-cms/plugin-test";

export const member = (id: string, role = 10) => ({
	id,
	email: `${id}@example.com`,
	name: id,
	role,
	createdAt: "2026-01-01T00:00:00.000Z",
});
export const ana = member("ana");
export const ben = member("ben");
export const admin = member("root", 50);

/**
 * A real test site. The plain test host cannot publish content, so tests that need a
 * published entry use this. Call dispose() in afterEach.
 */
export async function openSite() {
	const rt = await createPluginRuntimeTestHost();
	const call = rt.transport.invokeRoute.bind(rt.transport);
	const asGuest = { method: "POST" };
	const as = (user: ReturnType<typeof member>, method = "POST") => ({ method, user });
	return { rt, call, as, asGuest, dispose: () => rt.dispose() };
}

/** Add the KnowX docs and FAQ collections, with published articles when given. */
export async function withDocs(
	rt: Awaited<ReturnType<typeof openSite>>["rt"],
	articles: Array<{ title: string; slug?: string; status?: string }> = [],
) {
	await rt.fixtures.collection({
		slug: "docs",
		label: "Help articles",
		labelSingular: "Help article",
		urlPattern: "/docs/{slug}",
		supports: ["drafts", "revisions", "search", "seo"],
		fields: [
			{ slug: "title", label: "Title", type: "string", required: true, searchable: true },
			{ slug: "excerpt", label: "Excerpt", type: "text", searchable: true },
			{ slug: "content", label: "Content", type: "portableText", searchable: true },
			{ slug: "applies_to_version", label: "Applies to version", type: "string" },
		],
	} as never);
	await rt.fixtures.collection({
		slug: "faq",
		label: "FAQs",
		labelSingular: "FAQ",
		urlPattern: "/docs/faq/{slug}",
		supports: ["drafts", "revisions", "search", "seo"],
		fields: [
			{ slug: "title", label: "Question", type: "string", required: true, searchable: true },
			{ slug: "answer", label: "Answer", type: "portableText", searchable: true },
		],
	} as never);
	const ids: string[] = [];
	for (const article of articles) {
		const made = await rt.fixtures.content("docs", {
			data: { title: article.title },
			slug: article.slug || article.title.toLowerCase().replace(/\s+/g, "-"),
			status: article.status || "published",
		} as never);
		ids.push(made.id);
	}
	return { ids };
}

/** Add the help category taxonomy and the given top-level terms. */
export async function withCategories(
	rt: Awaited<ReturnType<typeof openSite>>["rt"],
	terms: Array<{ slug: string; label: string; description?: string }>,
) {
	await rt.fixtures.taxonomyDefinition({
		name: "doc_category",
		label: "Help categories",
		labelSingular: "Help category",
		hierarchical: true,
		collections: ["docs"],
	});
	const created = [];
	for (const term of terms) {
		created.push(
			await rt.fixtures.taxonomy({
				name: "doc_category",
				slug: term.slug,
				label: term.label,
				data: term.description ? { description: term.description } : {},
			}),
		);
	}
	return { terms: created };
}

/** Add a posts collection with one public post and one draft. */
export async function withPosts(rt: Awaited<ReturnType<typeof openSite>>["rt"]) {
	await rt.fixtures.collection({
		slug: "posts",
		label: "Posts",
		labelSingular: "Post",
		urlPattern: "/posts/{slug}",
		supports: ["drafts", "revisions", "search"],
		fields: [{ slug: "title", label: "Title", type: "string", required: true }],
	} as never);
	const live = await rt.fixtures.content("posts", { data: { title: "Good Soup" }, slug: "good-soup", status: "published" } as never);
	const draft = await rt.fixtures.content("posts", { data: { title: "Secret Draft" }, slug: "secret-draft" } as never);
	return { live: live.id, draft: draft.id };
}

/** A guest request from this visitor address (what EmDash fills on Cloudflare or with trustedProxyHeaders). */
export const guest = (ip: string | null) => ({
	method: "POST",
	meta: { ip, userAgent: null, referer: null, geo: null },
});
