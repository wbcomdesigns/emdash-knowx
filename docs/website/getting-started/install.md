# Install KnowX

**Included in Free.** KnowX has no paid version.

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

## What each step does for KnowX

**Step 1.** EmDash lists what KnowX asks for: reading your content, your content types and your categories. It never changes your content. A **KnowX** group with **Insights** and **Settings** appears in the admin menu. Insights opens with a **Set up visitor pages** card that shows the same command for the version you installed.

**Step 2.** Each run clones into a new folder, so it works the same after an update. Any kit file you edited (the wording file, a style, a page) is saved next to it as `<file>.bak-YYYYMMDD` before the new one is copied, and the script lists those backups; files you never touched are replaced quietly. The script copies:

| Into your site | What it is |
| --- | --- |
| `src/pages/docs/` | Help home, each article, each topic, search results, the FAQ page |
| `src/components/` | `Helpful.astro`, `StillNeedHelp.astro`, `DocSearch.astro` |
| `src/lib/`, `src/styles/` | KnowX code and styles, plus the shared `wbcom-kit.ts` and `wbcom-base.css` |
| `src/lib/knowx-strings.ts` | Every word a visitor sees. Reword or translate it here |
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

goes in the top block, and `<DocSearch />` on the line after `<PortableText value={post.data.content} />`, so the box sits under the post text inside the post column. Placed outside the theme's frame it runs the full width of the window. The help pages wrap themselves in your site's layout through `src/layouts/KnowXLayout.astro`. It expects `src/layouts/Base.astro` taking `title` and `description`, as the EmDash templates ship. See [Wording and design](../customize/wording-and-design.md) if yours differs.

**Step 4.** In Admin, Menus, add **Help** linking to `/docs/` and **FAQ** linking to `/docs/faq/`.

**Step 5.** On **KnowX, Insights**, press **Visitor pages are set up** once `/docs/` opens. Then add your first article in **Content, Help articles** and your first question in **Content, FAQs**, and publish them. Open **KnowX, Settings** to set a contact link for "Still need help?" and the content types search covers.

## Check it worked

Open `/docs/` on your site. You see the search box and your topics. If you see a 404, the kit pages were not copied; see [Troubleshooting](../troubleshooting/troubleshooting.md).

Expected in the browser console: each time a guest votes on **Was this helpful**, one `401` from the member vote route. A signed-in member's vote counts only through that route, so the kit tries it first; a guest then votes through the guest route, or sees the sign-in link on a host with no visitor address. Nothing else from KnowX answers 401 to a guest. On a plugin installed from local files (not the registry), the first call of each visit shows one expected 404 while the kit finds the plugin's address.

## Guests and visitor addresses

EmDash gives a plugin the visitor's address only on Cloudflare, or when the site sets `trustedProxyHeaders` inside `emdash({ ... })` in `astro.config.mjs` (for example `trustedProxyHeaders: ["x-real-ip"],`). Without an address, guests are asked to sign in before they can vote on **Was this helpful**, so one person cannot vote many times, and help searches are not counted on Insights. Signed-in members still vote. Insights says so in one line while it is the case.

Set `trustedProxyHeaders` only to a header that **your proxy writes itself and replaces** on every request. EmDash reads the first address in that header. Many proxies **add** to `X-Forwarded-For` instead of replacing it (nginx `$proxy_add_x_forwarded_for`, most load balancers), so the first address is whatever the visitor typed, and a guest could vote again and again. Behind nginx, set `proxy_set_header X-Real-IP $remote_addr;` and use `trustedProxyHeaders: ["x-real-ip"]`. Behind another proxy, use the header it overwrites with the connecting address. If you are not sure, leave it unset: members can still take part.

## After you update the plugin

Run step 2 again with the new version's tag.
