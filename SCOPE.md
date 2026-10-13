# KnowX Knowledge Base: scope

This file is the contract for the plugin. Code, tests, docs and cards all follow it. If something here is wrong, change it here first, in the same pull request as the code.

## Purpose

Give a site a help center: articles in categories, a search that readers actually use, a Was-this-helpful vote on each article, and a report that tells the owner which articles fail and which searches find nothing.

**Who it is for:** Product and service sites that answer the same support questions repeatedly.

**WordPress source:** KnowX theme (`~/dev/repos/knowx`) for layout and wording only. It is a WordPress theme, so nothing ports directly. Do not copy PHP.

**Brand:** KnowX brand. No logo folder was found under `~/Documents/brand logos/`. Ask the owner for the KnowX mark before the branding card. The theme lives at `~/dev/repos/knowx`.

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

**Member accounts:** No member accounts needed. Every reader-facing feature works for guests.

How it stays general:

- Page titles and labels (Help center, Docs, Support, FAQ) are set by the owner, not fixed
- The base path (`/docs/`) is a folder the owner can rename when copying the kit
- Works with one category or fifty, and with no categories at all



## Decisions made with the owner

Settled. Do not reopen these in code review. Dated 2026-10-13 unless noted.

| Question | Decision |
| --- | --- |
| When a reader finds no answer | Offer a contact link. The owner sets one contact page or email in settings. |
| What search looks through | The owner picks. Help articles by default, plus any other content they add. |

## In scope for 0.1.0

- Articles live in a normal EmDash collection (`docs`) with a hierarchical category taxonomy. The kit ships the collection definition
- Kit pages: help center home (search box, category grid), category page, article page, search results
- Article page: breadcrumbs, table of contents built from headings, previous and next in the category, related articles
- Search route over published articles: title, excerpt and body text
- Was this helpful: yes or no, with an optional comment after a no. Open to guests
- Search log: each term with how often it was searched and whether it found anything
- Admin: article helpfulness table, feedback comments, top searches, searches with no results
- "Still need help?" with a contact button after a search with no results and after a No vote. The link is one setting. Hidden when the setting is empty
- The report counts how often each no-result search led to the contact link being shown
- Search covers the collections the owner lists: help articles by default, plus posts, pages or products if added. Each result says what kind of content it is

## Out of scope

Do not build these. If a card seems to need one, stop and ask the owner.

- Live chat or ticket hand-off
- AI answers
- Versioned docs
- Multi-product knowledge bases
- Article ratings on a 5-star scale (that is the Reviews plugin)
- Any paid or Pro feature
- Email sending (the host may have no mail configured)
- Portable Text blocks or anything that needs a native plugin
- Injecting scripts, styles or HTML into pages from the plugin

## Roles

| Role | Can do |
| --- | --- |
| Guest | Everything marked `public` in the routes table |
| Member | Signed in at subscriber role or above. Everything marked `member`, acting only on their own data |
| Admin | Everything marked `admin`, from the EmDash admin |

## Capabilities

`content:read`, `schema:read`

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
| `collection` | string | `docs` | Collection that holds the articles |
| `title` | string | `Help center` | Heading on the home page. The owner's own word for it |
| `ask_comment` | boolean | `true` | Ask for a comment after a No vote |
| `contact_url` | string | (empty) | A page path, a full link, or a `mailto:` address. Empty hides the prompt |
| `search_collections` | string | `docs` | Comma-separated collections that search looks through |

## Routes

Base: `/_emdash/api/plugins/knowx/<name>`.

| Route | Who | Methods | Input | Returns |
| --- | --- | --- | --- | --- |
| `health` | public | GET | - | `ok`, version, whether the collection exists, article count |
| `search` | public | GET | `q` | Up to 20 matches (title, excerpt, url, category). Logs the term. Each match carries its content type. Returns `contact_url` when there are no matches |
| `helpful` | public | POST | `id`, `helpful`, `comment` | Saved. One vote per visitor per article, rate limited per IP |
| `tally` | public | GET | `id` | `yes` and `no` counts for one article |
| `admin` | admin | POST | Block Kit | Insights and settings |

`member` means a private route with `permission: MEMBER`. `admin` means a private route with no permission set. A `public` route never receives a user.

## Hooks

None.

## Admin screens

| Page | What it shows |
| --- | --- |
| `/insights` | Stats, least helpful articles, recent feedback comments, top searches, searches with no results, settings |

## Site kit

| File | What it is |
| --- | --- |
| `site-kit/seed/collection.mjs` | The `docs` collection and `doc_category` taxonomy |
| `site-kit/pages/docs/index.astro` | Help center home |
| `site-kit/pages/docs/category/[...slug].astro` | Category page |
| `site-kit/pages/docs/[...slug].astro` | Article page |
| `site-kit/pages/docs/search.astro` | Search results |
| `site-kit/components/Helpful.astro` | `<Helpful id />` |
| `site-kit/components/DocSearch.astro` | Search box with results as you type |
| `site-kit/styles/knowx.css` | Layout for the four pages |

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
