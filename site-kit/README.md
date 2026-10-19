# KnowX site kit

The plugin is the engine. This folder is the site kit: the Astro pages and parts that give visitors `/docs/`. A registry plugin cannot add pages to a site, so the kit is copied into your site's code with one command.

## Before you install

**1. Your site needs a sandbox runner.** Registry plugins run in a sandbox. Until the site has one, Admin, Plugins shows "No plugins configured" and there is no Registry in the menu.

- **Node:** in your site, run `npm install @emdash-cms/sandbox-workerd workerd`, then add `sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox",` inside `emdash({ ... })` in `astro.config.mjs`.
- **Cloudflare:** add `import { sandbox } from "@emdash-cms/cloudflare";` and `sandboxRunner: sandbox(),`. It needs the Workers Paid plan and a `worker_loaders` binding named `LOADER` in your Wrangler config. The EmDash Cloudflare templates ship that binding commented out. EmDash's guide: https://docs.emdashcms.com/deployment/plugin-sandbox/#cloudflare-workers

Stop the dev server and start it again. **Registry** now shows in the admin menu.

**2. The plugin is the engine. Visitor pages come from its site kit.** A registry plugin cannot add pages to your site. Until you copy the kit, its addresses (for example `/docs/`) show your site's 404 page. That is expected. The kit copy below takes one command.

**3. You need Node 22.16 or later** for the `npx emdash seed` step.

Checked on EmDash 1.3.1 with the `blog` template on Node. The Cloudflare lines follow EmDash's own guide; we have not run them on a Cloudflare site yet.

## Install

1. Admin, Registry, search **KnowX**, Install, then accept the permissions.
2. From your site's root folder, get the kit for the version you just installed and copy it in:

   ```bash
   kit="$(mktemp -d)" &&
     git clone --depth 1 \
       --branch v0.1.5 \
       https://github.com/wbcomdesigns/emdash-knowx \
       "$kit/emdash-knowx" &&
     "$kit/emdash-knowx/scripts/add-to-site.sh" .
   ```

   (`mktemp -d` makes a fresh folder only you can write to, and `&&` runs the script only when the clone worked. Never clone into a fixed `/tmp/<name>`: on a shared machine someone else can create it first.)

   The script copies the kit, never replaces a newer shared file another Wbcom plugin already copied, keeps a backup of the wording file only when you changed it yourself, creates the content types the plugin needs (if any), and prints the exact lines to paste into your templates, with the file names.
3. Paste the lines it printed. Restart the dev server.
4. Add the menu links it printed in Admin, Menus.
5. Open the plugin in the admin and follow its first screen.

After every plugin update, run step 2 again with the new tag.

The full guide, with what the script copies and the content types it creates: [docs/website/getting-started/install.md](../docs/website/getting-started/install.md).

## Connect it to your design

Every KnowX page is wrapped in `src/layouts/KnowXLayout.astro`, and that file hands the page to your site's own layout. It expects `src/layouts/Base.astro` taking `title` and `description`, which is what the EmDash templates ship. If your layout has another name or other props, change that one file. No KnowX page needs editing, and a kit update never replaces it.

Colours and fonts come from your site: the kit reads the shared tokens in `wbcom-base.css` (`--wb-bg`, `--wb-text`, `--wb-surface`, `--wb-border`, `--wb-brand`) when they exist, and falls back to a neutral set when they do not. The help pages line up with your theme's frame (`--frame-width`, `--frame-padding`) when the theme has one.

To reword or translate what visitors see, edit `src/lib/knowx-strings.ts` only. When a kit update brings a new version of that file, `add-to-site.sh` keeps yours as `knowx-strings.ts.bak-YYYYMMDD` and says so.

## Before you add it to a live site

- **Search.** Help search uses EmDash search. Turn search on for every collection you tick on Settings.
- **Slugs.** A page with the slug `docs` would be hidden by the kit pages. Rename it first.
- **Guests.** Guests vote and their searches are counted only when the host gives EmDash the visitor's address (Cloudflare, or `trustedProxyHeaders` inside `emdash({ ... })` in `astro.config.mjs`, for example `trustedProxyHeaders: ["x-real-ip"],`). Elsewhere guests are asked to sign in, and members vote as usual. Set `trustedProxyHeaders` only to a header your proxy overwrites (behind nginx: `proxy_set_header X-Real-IP $remote_addr;` and `trustedProxyHeaders: ["x-real-ip"]`); see the install guide, Guests and visitor addresses.
- **Contact.** Set a contact page, http(s) link, or mailto address on Admin, KnowX, Settings. Leave it empty to hide "Still need help?".
- **Permissions.** The plugin only reads content, schema and taxonomies. It never writes site content.
- **Try it on a preview first.** Deploy a preview version, walk `docs/qa/QA_CHECKLIST.md` there, then go live.

## Who can do what

Guests can search, read articles, vote helpful (on a host that gives a visitor address), and use the contact link. Signed-in members can always vote. Admins use Insights and Settings.

## What you should see

- `/docs/` search box and topic cards (or a plain list when there is only one top-level category)
- `/docs/{slug}/` article, table of contents, previous and next, Was this helpful
- `/docs/search` results labelled by content type
- `/docs/faq/` short answers
- `/docs/category/{slug}/` articles in that topic
- Admin, KnowX: Insights and Settings, plus a card on the EmDash dashboard

Expected in the browser console: each time a guest votes on Was this helpful, one `401` from the member vote route. On a host that gives no visitor address, that `401` comes once when an article opens instead: the kit checks whether the reader is signed in, then shows a guest Yes and No as unavailable with the sign-in link. A signed-in member's vote counts only through that route, so the kit tries it first; a guest then votes through the guest route, or sees the sign-in link on a host with no visitor address. Nothing else from KnowX answers 401 to a guest.

## Working on this plugin

For KnowX developers only, not for site owners. `scripts/setup-lab.sh` builds a local blog-template lab with the plugin wired from this folder, `scripts/reset-lab.sh` rebuilds it with sample help content, and `scripts/prove-lab.sh` runs the route checks against it. `scripts/apply-kit.sh` copies the kit into the lab with `add-to-site.sh`. `scripts/make-seed.mjs` rebuilds `seed/knowx-seed.json` from `seed/collection.mjs`.
