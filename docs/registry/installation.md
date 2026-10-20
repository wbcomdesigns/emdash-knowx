## Before you install

**1. Your site needs a sandbox runner.** Registry plugins run in a sandbox. Until the site has one, Admin, Plugins shows "No plugins configured" and there is no Registry in the menu.

- **Node:** in your site, run `npm install @emdash-cms/sandbox-workerd workerd`, then add `sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox",` inside `emdash({ ... })` in `astro.config.mjs`.
- **Cloudflare: not supported yet.** On Cloudflare Workers EmDash gives each plugin call 10 requests to the site, and several of this plugin's pages and actions need more, so they fail. A release that fits is in progress. Node sites are not affected.

Stop the dev server and start it again. **Registry** now shows in the admin menu.

**2. The plugin is the engine. Visitor pages come from its site kit.** A registry plugin cannot add pages to your site. Until you copy the kit, its addresses (for example `/docs/`) show your site's 404 page. That is expected. The kit copy below takes one command.

**3. You need Node 22.16 or later** for the `npx emdash seed` step.

Checked on EmDash 1.3.1 with the `blog` template on Node.

## Install

1. Admin, Registry, search **KnowX**, Install, then accept the permissions.
2. From your site's root folder:

   ```bash
   kit="$(mktemp -d)" &&
     git clone --depth 1 \
       --branch v0.2.1 \
       https://github.com/wbcomdesigns/emdash-knowx \
       "$kit/emdash-knowx" &&
     "$kit/emdash-knowx/scripts/add-to-site.sh" .
   ```

3. Restart the dev server.
4. In Admin, Menus, add `/docs/` and `/docs/faq/`.
5. Open KnowX, Insights, then add articles in Content, Help articles.

Run step 2 again after every update. Guide: https://github.com/wbcomdesigns/emdash-knowx/blob/v0.2.1/docs/website/getting-started/install.md
