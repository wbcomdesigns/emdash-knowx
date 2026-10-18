# Install KnowX

**Included in Free.** KnowX has no paid version.

## Before you install

**1. Your site needs a sandbox runner.** Registry plugins run in a sandbox. Until the site has one, Admin, Plugins shows "No plugins configured" and there is no Registry in the menu.

- **Node:** in your site, run `npm install @emdash-cms/sandbox-workerd workerd`, then add `sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox",` inside `emdash({ ... })` in `astro.config.mjs`.
- **Cloudflare:** add `import { sandbox } from "@emdash-cms/cloudflare";` and `sandboxRunner: sandbox(),`. It needs the Workers Paid plan and a `worker_loaders` binding named `LOADER` in your Wrangler config. The EmDash Cloudflare templates ship that binding commented out. EmDash's guide: https://docs.emdashcms.com/deployment/plugin-sandbox/#cloudflare-workers

Stop the dev server and start it again. **Registry** now shows in the admin menu.

**2. The plugin is the engine. Visitor pages come from its site kit.** A registry plugin cannot add pages to your site. Until you copy the kit, its addresses (for example `/docs/`) show your site's 404 page. That is expected. The kit copy below takes one command.

**3. You need Node 22.16 or later** for the `npx emdash seed` step.

Checked on EmDash 1.3.0 with the `blog` template on Node. The Cloudflare lines follow EmDash's own guide; we have not run them on a Cloudflare site yet.

## Install

1. Admin, Registry, search **KnowX**, Install, then accept the permissions.
2. From your site's root folder, get the kit for the version you just installed and copy it in:

   ```bash
   kit="$(mktemp -d)" && git clone --branch v0.1.5 --depth 1 https://github.com/wbcomdesigns/emdash-knowx "$kit/emdash-knowx" && "$kit/emdash-knowx/scripts/add-to-site.sh" .
   ```

   (`mktemp -d` makes a fresh folder only you can write to, and `&&` runs the script only when the clone worked. Never clone into a fixed `/tmp/<name>`: on a shared machine someone else can create it first.)

   The script copies the kit, never replaces a newer shared file another Wbcom plugin already copied, keeps a backup of any wording file you changed, creates the content types the plugin needs (if any), and prints the exact lines to paste into your templates, with the file names.
3. Paste the lines it printed. Restart the dev server.
4. Add the menu links it printed in Admin, Menus.
5. Open the plugin in the admin and follow its first screen.

After every plugin update, run step 2 again with the new tag.

## What each step does for KnowX

**Step 1.** EmDash lists what KnowX asks for: reading your content, your content types and your categories. It never changes your content. A **KnowX** group with **Insights** and **Settings** appears in the admin menu. Insights opens with a **Set up visitor pages** card that shows the same command for the version you installed.

**Step 2.** Each run clones into a new folder, so it works the same after an update. The script copies:

| Into your site | What it is |
| --- | --- |
| `src/pages/docs/` | Help home, each article, each topic, search results, the FAQ page |
| `src/components/` | `Helpful.astro`, `StillNeedHelp.astro`, `DocSearch.astro` |
| `src/lib/`, `src/styles/` | KnowX code and styles, plus the shared `wbcom-kit.ts` and `wbcom-base.css` |
| `src/lib/knowx-strings.ts` | Every word a visitor sees. If yours differs, the old one is kept as `knowx-strings.ts.bak-YYYYMMDD` |
| `src/layouts/KnowXLayout.astro` | Hands each help page to your layout. Copied once, never replaced |
| `.emdash/knowx-seed.json` | The two content types below |

It then creates the content types. When your site keeps its database in a local SQLite file (the Node template), the script runs the seed for you. Otherwise it prints the command, with your site's real path. Run it from the site's root folder, with Node 22.16 or later:

```bash
npx emdash seed .emdash/knowx-seed.json --no-content
```

| Content type | Fields | Used for |
| --- | --- | --- |
| Help articles (`docs`) | Title, Excerpt, Content, Applies to version | Articles |
| FAQs (`faq`) | Question, Answer | The FAQ page |

plus a **Help categories** taxonomy for topics. Search is turned on for both. Anything you already have is left alone, and the seed never changes your menus. Leave out `--no-content` to also add four starter help categories you can rename.

**Step 3.** The help pages need nothing pasted. The script prints one optional pair of lines: a help search box on every blog post, for `src/pages/posts/[slug].astro`:

```astro
import DocSearch from "../../components/DocSearch.astro";
```

goes in the top block, and `<DocSearch />` where the box should show. The help pages wrap themselves in your site's layout through `src/layouts/KnowXLayout.astro`. It expects `src/layouts/Base.astro` taking `title` and `description`, as the EmDash templates ship. See [Wording and design](../customize/wording-and-design.md) if yours differs.

**Step 4.** In Admin, Menus, add **Help** linking to `/docs/` and **FAQ** linking to `/docs/faq/`.

**Step 5.** On **KnowX, Insights**, press **Visitor pages are set up** once `/docs/` opens. Then add your first article in **Content, Help articles** and your first question in **Content, FAQs**, and publish them. Open **KnowX, Settings** to set a contact link for "Still need help?" and the content types search covers.

## Check it worked

Open `/docs/` on your site. You see the search box and your topics. If you see a 404, the kit pages were not copied; see [Troubleshooting](../troubleshooting/troubleshooting.md).

A guest sees no 401 from KnowX in the browser console, with one exception: on a host that gives no visitor address, a guest's vote goes to the member route, answers 401, and the page shows the sign-in link. That 401 is expected. On a plugin installed from local files (not the registry), the first call of each visit shows one expected 404 while the kit finds the plugin's address.

## Guests and visitor addresses

KnowX limits guests by the address EmDash gives it for each visitor. EmDash gives one on Cloudflare, or when `astro.config.mjs` names the header your proxy sets:

```js
emdash({
	trustedProxyHeaders: ["x-forwarded-for"],
	// ...
}),
```

Only add that line when your site runs behind a proxy that sets the header. On a host that gives no address, a guest who votes on **Was this helpful** is asked to sign in, and searches are not counted on Insights. Signed-in members still vote. Insights says so in one line while it is the case.

## After you update the plugin

Run step 2 again with the new version's tag.
