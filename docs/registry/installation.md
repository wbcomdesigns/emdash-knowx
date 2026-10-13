1. Install KnowX from the registry and confirm the permissions (read content, schema and taxonomies).
2. Create a `docs` collection and a `faq` collection. The kit ships the field list in `site-kit/seed/`. Turn search on for both.
3. Copy the site kit into your site. Full steps: https://github.com/wbcomdesigns/emdash-knowx/blob/main/site-kit/README.md
4. Add menu links for `/docs/` and `/docs/faq/`.
5. Open Admin, then KnowX, then Settings. Set a contact link if you want "Still need help?", and tick the content types search should cover.

Your site needs a sandbox runner in `astro.config.mjs`. Without one, EmDash skips sandboxed plugins at startup.

A block inside an article (a search box or a list of articles) needs a trusted install. The registry package is the whole product without it. That extra is not in this release.
