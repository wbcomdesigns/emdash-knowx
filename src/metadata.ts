import { articleCollection, FAQ } from "./core";
import { asString } from "./util";

type PageLike = {
	url: string;
	path: string;
	kind: string;
	title: string | null;
	pageTitle?: string | null;
	description: string | null;
	canonical: string | null;
	content?: { collection: string; id: string; slug: string | null };
	articleMeta?: { publishedTime?: string | null; modifiedTime?: string | null };
	breadcrumbs?: Array<{ name: string; url: string }>;
	siteUrl?: string;
};

type JsonLd = { kind: "jsonld"; id?: string; graph: Record<string, unknown> };

function originOf(page: PageLike): string {
	if (page.siteUrl) return page.siteUrl.replace(/\/$/, "");
	try {
		return new URL(page.canonical || page.url).origin;
	} catch {
		return "";
	}
}

function breadcrumbItems(page: PageLike, helpPath: string): Array<Record<string, unknown>> | null {
	if (page.breadcrumbs && page.breadcrumbs.length === 0) return null;
	const origin = originOf(page);
	if (page.breadcrumbs && page.breadcrumbs.length > 0) {
		return page.breadcrumbs.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: crumb.url,
		}));
	}
	const title = asString(page.pageTitle) || asString(page.title) || "Article";
	const here = page.canonical || page.url;
	const help = origin ? `${origin}${helpPath}` : helpPath;
	return [
		{ "@type": "ListItem", position: 1, name: "Help", item: help },
		{ "@type": "ListItem", position: 2, name: title, item: here },
	];
}

export async function pageMetadata(page: PageLike, ctx: Parameters<typeof articleCollection>[0]): Promise<JsonLd[] | null> {
	const content = page.content;
	if (!content || page.kind !== "content") return null;
	const collection = await articleCollection(ctx);
	const isArticle = content.collection === collection;
	const isFaq = content.collection === FAQ;
	if (!isArticle && !isFaq) return null;

	const title = asString(page.pageTitle) || asString(page.title) || "";
	const url = page.canonical || page.url;
	const crumbs = breadcrumbItems(page, "/docs");
	const contributions: JsonLd[] = [
		{
			kind: "jsonld",
			id: `knowx-${isFaq ? "faq" : "article"}:${content.id}`,
			graph: {
				"@context": "https://schema.org",
				"@type": isFaq ? "FAQPage" : "Article",
				headline: title,
				description: page.description,
				url,
				dateModified: page.articleMeta?.modifiedTime || undefined,
				datePublished: page.articleMeta?.publishedTime || undefined,
			},
		},
	];
	if (crumbs) {
		contributions.push({
			kind: "jsonld",
			id: `knowx-breadcrumbs:${content.id}`,
			graph: {
				"@context": "https://schema.org",
				"@type": "BreadcrumbList",
				itemListElement: crumbs,
			},
		});
	}
	return contributions;
}
