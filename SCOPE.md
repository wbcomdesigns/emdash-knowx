# KnowX Knowledge Base: scope

**Status: LOCKED on 2026-10-13.** Scope and decisions were agreed with the owner. An agent does not add options or features. If a task cannot be done as written, stop, say why on its issue, and wait for the owner.

This file is the contract for the plugin. Code, tests, docs and cards all follow it. If something here is wrong, change it here first, in the same pull request as the code.

## Corrections after reading EmDash's own guides (2026-10-13)

**This section wins over any older line below that disagrees with it.**

- **Search is EmDash's own.** `LiveSearch` from `emdash/ui/search` for instant results, `search()` from `emdash` on the search page, and the Ctrl or Cmd + K pattern from EmDash's guide. KnowX builds no search box, no index and no search route. The collections it covers must have search turned on in their definition.
- **What KnowX adds around search:** limiting it to the current product, the "Still need help?" contact link, and the search log. The kit's search page runs `search()` on the server and reports the term and the result count to `log_search`. If `LiveSearch` cannot report what was typed, the log covers the search page only, and the report says so plainly.
- **Categories and products are EmDash's taxonomy.** A category has a name and a description only, so the product icon is kept in plugin storage keyed by the category and chosen on the Settings page from a fixed icon set.
- **Dashboard card** (`admin.widgets`): searches with no results this week, and the least helpful article.
- **Visitors first:** a visitor is never locked out by hosting. Trusted visitor address where EmDash supplies it, browser cookie otherwise, written content always approved first.
- **Block inside post text:** only with a trusted install. The registry install is the whole product without it.
- **FAQ** is its own EmDash collection, shown with the native open-and-close element and FAQ data for search engines.
- **Dates** ("Last updated") use the site's time zone and date format from EmDash's site settings.
- **Admin pages:** Insights (reports), Settings (contact link, ask for a comment after a No, what search covers, product icons), plus the dashboard card.

## Purpose

Give a site a help center: articles in categories, a search that readers actually use, a Was-this-helpful vote on each article, and a report that tells the owner which articles fail and which searches find nothing.

**Who it is for:** Product and service sites that answer the same support questions repeatedly.

**WordPress source:** KnowX theme (`~/dev/repos/knowx`) for layout and wording only. It is a WordPress theme, so nothing ports directly. Do not copy PHP.

**Brand:** KnowX, gold on charcoal. Full kit (mark, wordmark, horizontal, square, each in light, dark and white, plus PNGs and social banners) and the brand sheet: `~/Documents/brand logos/knowx/`. `icon.png` and `images/banner.png` in this repo come from it. Rebuild with the pipeline in `~/Documents/brand logos/_render-src/`, never by hand.

## Fits every kind of site

This plugin must work for any site owner, not one niche. Judge every screen and every word against this table.

| Kind of site | How the owner uses it |
| --- | --- |
| Blog or magazine | A FAQ or how-to section |
| Business or service site | Answers to the questions clients ask before and after buying |
| Shop or product site | Shipping, returns, sizing, product care |
| Community or membership | Community rules and getting-started guides |
| Docs or SaaS | The full help center and product docs |
| Portfolio or agency | Client onboarding and process guides |

**Member accounts:** No member accounts needed. Every reader-facing feature works for guests on a host that gives EmDash the visitor's address. Elsewhere guests sign in to vote (owner decision 2026-10-16).

How it stays general:

- The base path (`/docs/`) is a folder the owner can rename when copying the kit
- Works with one category or fifty, and with no categories at all
- Every visitor-facing word is in one wording file, so a non-English site or a site with its own vocabulary changes it in one place



## Decisions made with the owner

Settled. Do not reopen these in code review. Dated 2026-10-13 unless noted.

| Question | Decision |
| --- | --- |
| When a reader finds no answer | Offer a contact link. The owner sets one contact page or email in settings. |
| What search looks through | The owner picks. Help articles by default, plus any other content they add. |
| Wording and language | One wording file per plugin kit. Every visitor-facing phrase lives there, so an owner can translate or reword the plugin by editing one file. |
| Several products | Yes. Top-level categories are products, shown as cards with an icon and a description. One top-level category means no product layer. |
| Article page extras | Section tree, copy-link on headings, copy button on code, last updated date, Ctrl or Cmd + K for search. |
| FAQ | Yes, its own page, with FAQ data for search engines. |
| Versions | An optional "Applies to version" badge on an article. No changelog page here: Roadmap has one. |
| Search engine data | Articles and breadcrumbs. |
| Choosing what search covers | Tick-boxes of the site's real content types. |
| Setup and long lists | Developer guide plus one command. Next, Previous and find in admin. |

## Against the WordPress KnowX theme, checked 2026-10-13

| WordPress KnowX feature | Here |
| --- | --- |
| Docs home with search and cards, products as top-level categories with icon and description | Yes (no per-product colour) |
| Article page: section tree, On this page, copy-link, copy code, previous and next, last updated | Yes |
| Instant search with Ctrl or Cmd + K, per product or everywhere | Yes |
| FAQ page with FAQ data | Yes |
| "Applies to version" badge | Yes |
| Changelog page | No. Lives in the Roadmap plugin |
| Search engine data for articles and breadcrumbs | Yes |
| Light and dark toggle, theme colour, fonts | From the site itself |

Extra, not in the theme: Was this helpful, the search log, the report of weak articles and empty searches, and the contact link.

## In scope for 0.1.0

- Articles live in a normal EmDash collection (`docs`) with a hierarchical category taxonomy. The kit ships the collection definition
- Kit pages: help center home (search box, category grid), category page, article page, search results
- Article page: breadcrumbs, table of contents built from headings, previous and next in the category, related articles
- Search is EmDash's own (`search()` and `LiveSearch`), limited to the help content the owner ticks
- Was this helpful: yes or no, with an optional comment after a no. Open to guests
- Search log: each term with how often it was searched and whether it found anything
- Admin: article helpfulness table, feedback comments, top searches, searches with no results
- "Still need help?" with a contact button after a search with no results and after a No vote. The link is one setting. Hidden when the setting is empty
- The report counts how often each no-result search led to the contact link being shown
- Search covers the collections the owner lists: help articles by default, plus posts, pages or products if added. Each result says what kind of content it is
- One wording file, `site-kit/lib/knowx-strings.ts`: every phrase a visitor can see (buttons, labels, messages, empty states, errors shown to visitors). Components and pages take their text only from it

## Out of scope

Do not build these. If a card seems to need one, stop and ask the owner.

- Live chat or ticket hand-off
- AI answers
- Versioned docs beyond the "Applies to version" badge
- A changelog page (the Roadmap plugin has one)
- A colour per product
- Article ratings on a 5-star scale (that is the Reviews plugin)
- Any paid or Pro feature
- Email sending
- Portable Text blocks or anything that needs a native plugin
- Injecting scripts, styles or HTML into pages from the plugin
- Translating the admin screens, and switching language per visitor. The wording file holds one language

## Roles

| Role | Can do |
| --- | --- |
| Guest | Everything marked `public` in the routes table |
| Member | Signed in at subscriber role or above. Everything marked `member`, acting only on their own data |
| Admin | Everything marked `admin`, from the EmDash admin |

## Capabilities

`content:read`, `schema:read`, `taxonomies:read`

`taxonomies:read` is so Settings can list help categories by name when the owner picks a product icon. Added with the owner on 2026-10-13.

Ask for nothing more without the owner's agreement: every capability is shown to the site owner at install.

## Data schema

### `feedback`

Row id: `<docId>:<visitorHash>`. One vote per visitor per article. Indexes: `doc`, `doc_helpful`, `createdAt`.

| Field | Type | Notes |
| --- | --- | --- |
| `doc` | string | Article entry id |
| `doc_helpful` | string | `<docId>:yes` or `<docId>:no`. Counted with `storage.count` |
| `helpful` | boolean |  |
| `comment` | string | Optional, up to 500 characters, only after a no |
| `visitor` | string | SHA-256 of the IP plus a per-site salt. Never the IP itself |
| `createdAt` | string | ISO time |

### `product_icons`

Row id: the category term id. Indexes: `slug`, `icon`.

| Field | Type | Notes |
| --- | --- | --- |
| `slug` | string | Category slug at the time it was saved |
| `label` | string | Category name |
| `icon` | string | One of the fixed icon set |
| `updatedAt` | string | ISO time |

### `searches`

Row id: The normalised term (lowercase, trimmed, 80 characters max). Indexes: `found`, `count`, `lastAt`.

| Field | Type | Notes |
| --- | --- | --- |
| `term` | string |  |
| `count` | number | Times searched |
| `found` | boolean | Whether the last search returned anything |
| `results` | number | Result count of the last search |
| `lastAt` | string | ISO time |

## Settings

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `collection` | string | `docs` | Collection that holds the articles. Internal: never shown on the Settings page |
| `ask_comment` | boolean | `true` | Ask for a comment after a No vote |
| `contact_url` | string | (empty) | A page path, a full link, or a `mailto:` address. Empty hides the prompt |
| `search_collections` | string | `docs` | Content types the help search covers. Set with tick-boxes |

## Routes

Base: `/_emdash/api/plugins/knowx/<name>`.

| Route | Who | Methods | Input | Returns |
| --- | --- | --- | --- | --- |
| `health` | public | GET | - | `ok`, version, whether the collection exists, article count |
| `products` | public | GET | - | Top-level categories with name, description and icon. One item means the kit shows no product layer |
| `log_search` | public | POST | `q`, `found` (count), honeypot field | Records the term and whether it found anything. Rate limited per visitor. The search itself is EmDash's, run by the kit page |
| `helpful` | public | POST | `id`, `helpful`, `comment` | Saved. One vote per visitor per article, rate limited per IP |
| `tally` | public | GET | `id` | `yes` and `no` counts for one article |
| `admin` | admin | POST | Block Kit | Insights and settings |

`member` means a private route with `permission: MEMBER`. `admin` means a private route with no permission set. A `public` route never receives a user.

## Hooks

None.

## Admin screens

| Page | What it shows |
| --- | --- |
| `/insights` | Stats, least helpful articles, recent feedback comments, top searches, searches with no results |
| `/settings` | Contact link, ask for a comment after a No, what search covers, product icons for top-level categories |

## Site kit

| File | What it is |
| --- | --- |
| `site-kit/seed/collection.mjs` | The `docs` and `faq` collections (search on) and the `doc_category` taxonomy |
| `site-kit/pages/docs/index.astro` | Help center home |
| `site-kit/pages/docs/category/[...slug].astro` | Category page |
| `site-kit/pages/docs/[...slug].astro` | Article page |
| `site-kit/pages/docs/search.astro` | Search results |
| `site-kit/components/Helpful.astro` | `<Helpful id />` |
| `site-kit/components/DocSearch.astro` | Search box with results as you type |
| `site-kit/styles/knowx.css` | Layout for the four pages |
| `site-kit/lib/knowx-products.ts` | Whether the help home shows product cards (more than one top-level category) |
| `site-kit/lib/knowx-strings.ts` | The wording file. The only place visitor-facing text is written |

Plus the two shared files every Wbcom plugin kit carries: `site-kit/lib/wbcom-kit.ts` and `site-kit/styles/wbcom-base.css`.

## Screens and their states

A screen is done when every state listed here has been seen in a browser at 1440, 768 and 390, in light and dark.

| Screen | States that must exist |
| --- | --- |
| Home | Search box in focus order first, category grid with article counts, empty state when there are no articles |
| Category | Breadcrumbs, article list, empty state |
| Article | Breadcrumbs, table of contents (hidden when fewer than 3 headings), previous and next, related, helpful widget |
| Search | Results as you type with a 300ms pause, no-results state with a suggestion, error state |
| Helpful widget | Idle, thanks after yes, comment box after no, already voted, error |
| Admin insights | Each table has an empty state. Search terms and comments shown as plain text |
| Still need help | A calm panel with one button, after no results and after a No vote. Absent when the owner has not set a contact link |

## Risks and open questions

- Search reads published articles and filters in the plugin. Fine for a few hundred articles. Confirm `ctx.content.list` limits and whether a `where` on searchable text exists before choosing the approach
- `helpful` and `search` are public writes. Rate limit per IP, cap lengths, and never echo a logged term into admin HTML unescaped
- `requestMeta.ip` may be empty on some hosts. Then every visitor shares one vote bucket: decide and document the fallback
- The search log must not store personal data. Drop terms that look like an email address or a long number
- Kit pages must not import starter-only files. Take the layout as a prop or document the one import to change
- Article pages are cached. The helpful widget and its counts load in the browser
- `contact_url` is owner input that becomes a link on public pages. Accept only a site path, an http(s) link or a mailto address
- Searching several collections multiplies the read cost. Cap the total and say so in the setting's help text
- Messages that come back from a route (for example a refusal) reach the visitor too. Routes return a stable `code`; the kit maps codes to phrases from the wording file and never prints the route's own English message
