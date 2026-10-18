# Changelog

Versions match `package.json`, the git tag and the registry release. Newest first. Never publish a version that is not on `origin/main`.

## [0.1.5] - 2026-10-19

Copy the site kit again after you update: run the two lines from the install guide with the new tag.

- Security - Guests can vote and have searches counted only when the host gives EmDash the visitor's address (Cloudflare, or trustedProxyHeaders); elsewhere guests see a sign-in link and signed-in members vote through two new member routes.
- Security - The search log keeps at most 5000 terms, and a forged "results found" can no longer hide a search that found nothing.
- Security - Phone numbers typed with dashes or brackets are never stored in the search log, and a contact link with a backslash is refused.
- New      - One command copies the site kit and creates the Help articles and FAQs content types: scripts/add-to-site.sh.
- New      - Insights opens with a Set up visitor pages card that gives the kit command for the installed version, until you mark the pages as set up.
- Improve  - Insights says where to add the first help article and FAQ, by name, and says plainly when guests cannot vote on this host.
- Improve  - Install guides start with what the site needs first (sandbox runner, Node 22.16, the kit at the release tag) and were checked on EmDash 1.3.0.
- Fix      - Help pages line up with the theme's header and footer instead of sitting 8px inside them.
- Fix      - Kit buttons keep 4.5:1 contrast in dark mode on the blog template (shared kit styles version 4).

## [0.1.4] - 2026-10-15

Copy `site-kit/` again after you update.

- Security - Help pages read their settings and log searches inside EmDash itself, with no web request, so a visitor can never make the site call another address.

## [0.1.3] - 2026-10-14

Copy `site-kit/` again after you update.

- Improve  - One command creates the help collections: `npx emdash seed <kit>/seed/knowx-seed.json --no-content`. It never changes your menus.
- Improve  - User guides: use cases, and how to use KnowX with blog posts and pages.
- Fix      - Related articles no longer repeat the articles shown as Previous and Next.
- Fix      - Help search links page results to /pages/<slug>, where the EmDash blog template serves pages.
- Fix      - The help center follows the site's light or dark choice, so it stays readable when a visitor picks light mode on a device set to dark.

## [0.1.2] - 2026-10-14

Copy `site-kit/` again after you update.

- Improve  - After a vote the chosen button stays highlighted. A sent comment is confirmed and its box closes.
- Improve  - "Still need help?" under an article has even spacing.
- Improve  - Screen readers hear how many readers found an article helpful, in words.
- Improve  - User guides for site owners in docs/website.
- Fix      - The install guide copies the shared kit files only when the site's copy is older.

## [0.1.1] - 2026-10-14

Copy `site-kit/` again after you update.

- Improve  - Help home shows Topics and a list of articles, so the page is no longer a title and three cards on a blank frame.
- Improve  - Topic cards, search hits, FAQ rows and article extras use the same card density. The first FAQ answer is open.
- Improve  - The search results page has one search box. JavaScript-off search still works.
- Improve  - Article page: table of contents, previous/next and related articles are cards. Dark mode inputs follow the system setting.
- Fix      - The kit finds the plugin at the registry id or the name knowx, so a registry install no longer 404s on config, vote and search log.
- Fix      - Breadcrumbs put a space after each slash (Help / Account, not Help /Account).
- Fix      - A search hit shows a line from the article when the search snippet only repeats the title.
- Fix      - Help pages sit in the theme column (same max width and side padding as the header).
- Fix      - A long search query wraps and is capped at 100 characters in the heading (80 in the log).
- Fix      - Copy link shows on hover or focus. Headings have space above them. Previous and Next stay in the column.
- Fix      - The search results page has one labelled field. Live search has a name for screen readers.
- Fix      - Settings uses tabs. Insights opens with counts and a search chart, not setup sentences.
- Fix      - The kit paints its own canvas in dark, so Topics and article body stay readable when the host page stays light.
- Fix      - Article copy-link is an icon with a name, not a "Copy link" pill inside the heading.
- Fix      - Missing-article page uses a heading. Article search uses the same card as home.
- Fix      - Article pager no longer draws an empty card when there is only a Next or Previous link.
- Fix      - Registry banner is 3000 by 1000. Screenshots are 1440 by 900 from a styled site.

## [0.1.0] - 2026-10-14

First release. Copy `site-kit/` after you install.

- New      - Help center home, topic, article, search and FAQ pages in the site kit.
- New      - Was this helpful on each article. After a No the reader can leave a short comment.
- New      - Search uses EmDash search. The owner ticks which content types it covers. Each result is labelled by type.
- New      - Insights: least helpful articles by name, comments, top searches, searches with no results.
- New      - Settings: contact link, ask for a comment after a No, search coverage, product icons.
- New      - A card on the EmDash dashboard: empty searches this week, and the least helpful article.
- New      - Article and breadcrumb structured data on help articles.
- Fix      - Copy-link and vote buttons meet the 40px tap size.
- Fix      - LiveSearch leftover "Searching" and "no results" text no longer stays on screen with results.
- Fix      - LiveSearch names each result Help article, Post, FAQ or Page, not the collection slug.
