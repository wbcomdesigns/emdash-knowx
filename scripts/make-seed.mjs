// Writes site-kit/seed/knowx-seed.json from site-kit/seed/collection.mjs, so a site owner can
// create the help collections with one command: npx emdash seed <kit>/seed/knowx-seed.json
// Menus are left out on purpose: a seed must never touch the site's own menu.
import { writeFileSync } from "node:fs";
import { docsCollection, faqCollection, docTaxonomies } from "../site-kit/seed/collection.mjs";

export const seed = {
	version: "1",
	meta: { name: "KnowX help center", description: "The docs and faq collections and help categories." },
	collections: [docsCollection, faqCollection],
	taxonomies: docTaxonomies,
};

if (import.meta.url === `file://${process.argv[1]}`) {
	writeFileSync(new URL("../site-kit/seed/knowx-seed.json", import.meta.url), `${JSON.stringify(seed, null, "\t")}\n`);
	console.log("Wrote site-kit/seed/knowx-seed.json");
}
