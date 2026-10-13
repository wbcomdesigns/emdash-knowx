import { readFileSync, writeFileSync } from "node:fs";

import { docs, faqs } from "../site-kit/seed/articles.mjs";
import { docsCollection, docTaxonomies, faqCollection, knowxMenuItems } from "../site-kit/seed/collection.mjs";
import { labRoot, labSeedPath } from "./paths.mjs";

const lab = labRoot();
const seedPath = labSeedPath(lab);
const seed = JSON.parse(readFileSync(seedPath, "utf8"));

seed.collections ||= [];
for (const next of [docsCollection, faqCollection]) {
	const existing = seed.collections.find((item) => item.slug === next.slug);
	if (existing) {
		const have = new Set(existing.fields.map((field) => field.slug));
		for (const field of next.fields) {
			if (!have.has(field.slug)) existing.fields.push(field);
		}
		existing.supports = Array.from(new Set([...(existing.supports || []), ...next.supports]));
		existing.urlPattern = existing.urlPattern || next.urlPattern;
	} else {
		seed.collections.push(structuredClone(next));
	}
}

seed.taxonomies ||= [];
for (const next of docTaxonomies) {
	const tax = seed.taxonomies.find((item) => item.name === next.name);
	if (tax) {
		tax.terms = next.terms;
		tax.hierarchical = true;
		tax.collections = Array.from(new Set([...(tax.collections || []), ...next.collections]));
	} else {
		seed.taxonomies.push(structuredClone(next));
	}
}

seed.content ||= {};
seed.content.docs = docs;
seed.content.faq = faqs;

const menu = seed.menus?.[0];
if (menu) {
	const urls = new Set(menu.items.map((item) => item.url));
	for (const item of knowxMenuItems) {
		if (!urls.has(item.url)) menu.items.push(item);
	}
}

writeFileSync(seedPath, `${JSON.stringify(seed, null, "\t")}\n`);
console.log(`Seeded ${docs.length} help articles and ${faqs.length} FAQs into ${seedPath}`);
