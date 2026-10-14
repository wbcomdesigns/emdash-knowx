# KnowX site kit

The plugin is the engine. This folder is what an EmDash site owner copies so visitors get `/docs/`.

Install `@wbcomdesigns/emdash-knowx` first (or the local package). Then apply this kit. The plugin alone does not create pages.

A registry install mounts the plugin at a generated id, not the name `knowx`. `wbcom-kit.ts` tries that id first, then the name. Copy this kit again after every plugin update.

## Apply on a site

On the lab, prefer `./scripts/apply-kit.sh` (or `./scripts/setup-lab.sh` the first time). Manual copy from the site root (`src/` is the Astro app):

```bash
K=path/to/knowx/site-kit

# The one file that connects the KnowX pages to your design (see below)
mkdir -p src/layouts src/styles src/lib src/pages/docs src/pages/docs/category src/pages/docs/faq src/components

cp $K/layouts/KnowXLayout.astro src/layouts/KnowXLayout.astro

cp $K/styles/knowx.css src/styles/knowx.css

cp $K/lib/knowx.ts src/lib/knowx.ts
cp $K/lib/knowx-strings.ts src/lib/knowx-strings.ts
cp $K/lib/knowx-products.ts src/lib/knowx-products.ts
cp $K/lib/knowx-icons.ts src/lib/knowx-icons.ts

cp $K/components/*.astro src/components/
cp $K/pages/docs/index.astro src/pages/docs/index.astro
cp $K/pages/docs/search.astro src/pages/docs/search.astro
cp $K/pages/docs/\[...slug\].astro src/pages/docs/
cp $K/pages/docs/category/\[...slug\].astro src/pages/docs/category/
cp $K/pages/docs/faq/index.astro src/pages/docs/faq/index.astro

# The two shared files are used by every Wbcom plugin. Line 1 carries a number
# (wbcom-shared: N). Copy only when the site has no copy yet or an older one,
# so another plugin's newer copy is never replaced.
shared() { v="$(sed -n '1s/.*wbcom-shared: *\([0-9]*\).*/\1/p' "$1" 2>/dev/null)"; echo "${v:-0}"; }
newer() { [ ! -f "$2" ] || [ "$(shared "$1")" -ge "$(shared "$2")" ]; }
newer "$K/lib/wbcom-kit.ts" src/lib/wbcom-kit.ts && cp "$K/lib/wbcom-kit.ts" src/lib/wbcom-kit.ts
newer "$K/styles/wbcom-base.css" src/styles/wbcom-base.css && cp "$K/styles/wbcom-base.css" src/styles/wbcom-base.css
```

Create the `docs` and `faq` collections and the help categories from the site root:

```bash
npx emdash seed $K/seed/knowx-seed.json --no-content
```

Search is turned on for both. Existing collections are left alone. The seed never changes your menus. `scripts/make-seed.mjs` rebuilds the file from `seed/collection.mjs`.

Add menu links for `/docs/` and `/docs/faq/`.

`astro.config.mjs` must load the sandbox runner and the plugin.

## Connect it to your design

Every KnowX page is wrapped in `src/layouts/KnowXLayout.astro`, and that file hands the page to your site's own layout. It expects `src/layouts/Base.astro` taking `title` and `description`, which is what the EmDash templates ship. If your layout has another name or other props, change that one file. No KnowX page needs editing, and a kit update never replaces it.

Colours and fonts come from your site: the kit reads the shared tokens in `wbcom-base.css` (`--wb-bg`, `--wb-text`, `--wb-surface`, `--wb-border`, `--wb-brand`) when they exist, and falls back to a neutral set when they do not.

To reword or translate what visitors see, edit `src/lib/knowx-strings.ts` only.

## Before you add it to a live site

- **EmDash version.** Built and tested on EmDash 1.2. Update the site first.
- **Search.** Help search uses EmDash search. Turn search on for every collection you tick on Settings.
- **Slugs.** A page with the slug `docs` would be hidden by the kit pages. Rename it first.
- **Contact.** Set a contact page, http(s) link, or mailto address on Admin, KnowX, Settings. Leave it empty to hide "Still need help?".
- **Permissions.** The plugin only reads content, schema and taxonomies. It never writes site content.
- **Try it on a preview first.** Deploy a preview version, walk `docs/qa/QA_CHECKLIST.md` there, then go live.

## Who can do what

Guests can search, read articles, vote helpful, and use the contact link. Signing in changes nothing. Admins use Insights and Settings.

## What you should see

- `/docs/` search box and topic cards (or a plain list when there is only one top-level category)
- `/docs/{slug}/` article, table of contents, previous and next, Was this helpful
- `/docs/search` results labelled by content type
- `/docs/faq/` short answers
- `/docs/category/{slug}/` articles in that topic
- Admin, KnowX: Insights and Settings, plus a card on the EmDash dashboard

## Lab prove

```bash
./scripts/reset-lab.sh
./scripts/prove-lab.sh
```
