# Changelog

Versions match `package.json`, the git tag and the registry release. Newest first. Never publish a version that is not on `origin/main`.

## [0.2.0] - 2026-10-20

Every help page, vote, search, admin screen and action now fits Cloudflare's limit of 10 requests per plugin call. No new permission. Copy the site kit again after you update.

- New      - Each article keeps its Yes and No counts, updated in the same step as the vote, so a page reads them in one request on any size of site.
- New      - A Searches screen holds Top searches and Searches with no results; Insights keeps the counts, the chart, the least helpful articles and the recent comments.
- New      - Votes, comments and search counts from 0.1.x are brought over a step at a time as Insights opens, with a progress card and Continue.
- Improve  - The site keeps its helpful rate and its searches per day in one record, so Insights and the dashboard card open in a few requests.
- Improve  - Settings reads every setting in one request and saves each tab with one write.
- Improve  - The help home reads every product icon in one request.
- Improve  - Articles on Insights and the health check count up to 100 and then show 100+.
- Improve  - Yes and No on Was this helpful work as soon as the page is interactive and show a pending state while the vote is sent; whether guests may vote is asked once per browser session.
- Improve  - A top-level help card with sub-categories names them next to its count of articles filed directly in it.
- Fix      - On Cloudflare a guest or member vote no longer shows "Something went wrong" after the vote was saved.
- Fix      - On Cloudflare Insights, Settings, every Settings save, the dashboard card and Top searches paging no longer fail with too many requests.
- Fix      - On Cloudflare a search at the 5000-term log cap is counted without passing the limit, and a burst of searches never retries past it.
- Fix      - The Insights setup card no longer says the command creates the content types on every host; on a site without a local SQLite database it points to creating them in the admin.
- Fix      - Visitor pages are set up is saved with the plugin version and stays after a reload.
- Security - Every vote checks that its article is published at that moment; a vote on a draft, unpublished or trashed article is refused and nothing is stored.

## [0.1.5] - 2026-10-19

Copy the site kit again after you update: run the command from the install guide with the new tag.

- Security - Guests can vote and searches are counted only when the host gives EmDash the visitor's address (Cloudflare, or trustedProxyHeaders); elsewhere a guest who votes is asked to sign in, and signed-in members vote through a new member route.
- Security - A signed-in member's vote counts only through the member route, so a member no longer gets one vote by address and another by account.
- Security - The search log keeps at most 5000 terms, a forged "results found" can no longer hide a search that found nothing, and oversized log requests are refused.
- Security - Phone numbers typed with dashes or brackets are never stored in the search log, and a contact link with a backslash or a control character is refused.
- New      - One command copies the site kit and creates the Help articles and FAQs content types: scripts/add-to-site.sh.
- New      - Insights opens with a Set up visitor pages card that gives the kit command for the installed version, with Show the setup steps again once it is closed.
- New      - Top searches on Insights has a find box and pages 25 terms at a time.
- Improve  - Insights counts every search and every vote, not only the latest 100 rows, and keeps empty searches listed for 30 days however busy other terms are.
- Improve  - Insights says where to add the first help article and FAQ, by name, and says plainly when guests cannot vote on this host.
- Improve  - Copying the kit again backs up only the kit files you edited, lists them, and says when it upgrades a shared file.
- Improve  - Install guides start with what the site needs first (sandbox runner, Node 22.16, the kit at the release tag), explain which proxy header to trust, and were checked on EmDash 1.3.1.
- Fix      - Help pages line up with the theme's header and footer instead of sitting 8px inside them.
- Fix      - Kit buttons keep 4.5:1 contrast in dark mode on the blog template (shared kit styles version 4).
- Fix      - A site still on the 0.1.4 engine keeps one vote per browser after copying the new kit.

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
