export const DOCS = "docs";
export const FAQ = "faq";
export const DOC_CATEGORY = "doc_category";

export const docsFields = [
	{ slug: "title", label: "Title", type: "string", required: true, searchable: true },
	{ slug: "excerpt", label: "Excerpt", type: "text", searchable: true },
	{ slug: "content", label: "Content", type: "portableText", searchable: true },
	{ slug: "applies_to_version", label: "Applies to version", type: "string" },
];

export const faqFields = [
	{ slug: "title", label: "Question", type: "string", required: true, searchable: true },
	{ slug: "answer", label: "Answer", type: "portableText", searchable: true },
];

export const docsCollection = {
	slug: DOCS,
	label: "Help articles",
	labelSingular: "Help article",
	description: "KnowX help center articles",
	icon: "book",
	urlPattern: "/docs/{slug}",
	supports: ["drafts", "revisions", "preview", "search", "seo"],
	fields: docsFields,
};

export const faqCollection = {
	slug: FAQ,
	label: "FAQs",
	labelSingular: "FAQ",
	description: "KnowX frequently asked questions",
	icon: "help",
	urlPattern: "/docs/faq/{slug}",
	supports: ["drafts", "revisions", "preview", "search", "seo"],
	fields: faqFields,
};

export const categoryTerms = [
	{
		slug: "getting-started",
		label: "Getting started",
		description: "First steps after you open the product.",
	},
	{
		slug: "using-the-product",
		label: "Using the product",
		description: "Everyday tasks and how to find things.",
	},
	{
		slug: "account-and-billing",
		label: "Account and billing",
		description: "Your account, plans and invoices.",
	},
	{
		slug: "first-week",
		label: "First week",
		description: "What to do in the first few days.",
		parent: "getting-started",
	},
];

export const docTaxonomies = [
	{
		name: DOC_CATEGORY,
		label: "Help categories",
		labelSingular: "Help category",
		hierarchical: true,
		collections: [DOCS],
		terms: categoryTerms,
	},
];

export const knowxMenuItems = [
	{ type: "custom", label: "Help", url: "/docs" },
	{ type: "custom", label: "FAQ", url: "/docs/faq" },
];
