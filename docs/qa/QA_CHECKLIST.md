# QA checklist: KnowX Knowledge Base

One living list of flow-level cases. Walk all of it before every release. When you add or fix behaviour, add or change its case in the same pull request. There are no per-release QA files.

**Last walk:** 2026-10-14, 0.1.1 team issues #22-#29 on lab :4333. `npm test` 24 passed. `prove-lab.sh` passed.

Walked in the browser: G-1, G-2, G-4, G-7, G-8, G-10, #22.2 (excerpt line), #22.3 (Help / Topic), #25 (`.kx` max-width 1200, x=120 at 1440, same as `--wide-width`), #26 (400-letter query, no sideways scroll, heading capped), #27 (copy link opacity 0 until hover, heading gap 28px, pager inside the column), #28 (one labelled search field on results). Presentation: 1440/768/390, light and dark, no horizontal overflow. Registry shots 1440x900 from the styled blog lab. Banner 3000x1000.

Checked at route level: prove-lab (health, admin Insights/Settings/widget, products, config, log_search, helpful, search labels, posts coverage, nested first-week). Kit fetch tests: registry id `r_2bzw2y6sgiq5c455`, local slug fallback, never remember a failure. A-1 empty Insights tables in tests. A-4 missing collection in tests.

Earlier the same day (same lab): G-3, G-5, G-6, G-9, G-11, G-13, G-14, G-15, G-92, M-1, A-2, A-3, A-5, A-6, P-1 to P-8, RTL.

Not walked live: A-1 on a wiped Insights store (shared lab already has searches; least-helpful empty state was on screen). A-4 from Settings (internal `collection` key, never on that screen).

When you walk it, replace that line with the date, the version, and three lists: cases walked in the browser, cases checked at route level only, cases not walked. Do not claim a case you did not run.

## Setup

```bash
./scripts/reset-lab.sh             # clean data, lab running
./scripts/prove-lab.sh             # route-level smoke, must pass first
./scripts/lab-role.sh subscriber   # member cases as the lowest signed-in role
./scripts/lab-role.sh admin        # back to admin
```

Three roles, in this order: guest (private window), member (subscriber), admin. A case proven only as admin is not proven. Name test data `QA-RFT ...` and reset the lab afterwards.

## Guest

| ID | Steps | Expected |
| --- | --- | --- |
| G-1 | Search for a word that is in an article title | The article is in the results |
| G-2 | Search for nonsense | No-results state with a suggestion |
| G-3 | Search for an email address | Results as normal. The term is not logged |
| G-4 | Click Yes on an article | Thanks message. Tally goes up by one |
| G-5 | Click No, add a comment | Comment saved. Tally shows the no |
| G-6 | Vote again on the same article | The vote changes. The total does not grow |
| G-7 | Open the help center home | Search box and category grid with counts |
| G-8 | Open a nested category | Breadcrumbs and its articles |
| G-9 | Open an article with five headings | Table of contents links jump to each heading |
| G-10 | Open an article url that does not exist | 404 page with a 404 status |
| G-11 | Type in the search box | Results appear after a short pause. Arrow keys move through them |
| G-12 | Turn JavaScript off and search | The results page works |
| G-13 | Contact link set: search for nonsense, and vote No on an article | Both show Still need help with a working button |
| G-14 | Contact link empty: do the same | No panel, no empty box |
| G-15 | Add `posts` to the search setting, search for a word from a post | The post is in the results, labelled as a post |
| G-92 | Change three phrases in the wording file (a button, an empty state, an error), rebuild | Each change shows everywhere that phrase is used. No English left on screen that is not in the file |

## Member (subscriber role)

| ID | Steps | Expected |
| --- | --- | --- |
| M-1 | Do G-4 to G-6 signed in | Same behaviour. Signing in changes nothing in this plugin |

## Admin

| ID | Steps | Expected |
| --- | --- | --- |
| A-1 | Open Insights and Searches with no data | Every table shows an empty state |
| A-2 | Open Insights after votes and searches, then Searches | Insights: least helpful articles by name, comments by article name, helpful rate, searches this week. Searches: top searches, no-result searches |
| A-3 | Search for `<script>` as a guest, then open Searches | The term shows as plain text |
| A-4 | Change the collection setting to one that does not exist | A clear message. Search returns nothing instead of failing |
| A-5 | Set the contact link to a `javascript:` address | Refused. Only a path, an http(s) link or a mailto address is accepted |
| A-6 | Open the EmDash dashboard | The KnowX card shows empty searches this week and the least helpful article, with links to Insights and Searches |
| A-7 | Fresh site, kit not copied: open Insights | Setup card says the command copies the kit and, on a site with a local SQLite database, creates the content types; on any other site it says to create them in the admin as the install guide shows |
| A-8 | Press Visitor pages are set up, reload Insights, then Show the setup steps again; update the plugin | The card is one line after the press and after the reload, comes back on Show the setup steps again, and comes back after a version change |
| A-9 | Site updated from 0.1.5 with votes, comments and a week of searches: open Insights repeatedly | "Bringing over data from KnowX 0.1" with a vote count and Continue, then "Insights is ready" with Show Insights, then the full page. Helpful rate, least helpful articles (by name), comments and the searches chart match what 0.1.5 showed. Pressing Continue twice quickly, or Insights open in two tabs, counts nothing twice. A trashed article never shows in Least helpful |
| A-10 | Site with more than 100 published articles: open Insights | Articles shows 100+ |
| A-11 | Searches: Find, Load more, Previous page, First page; leave and open Searches again | Each works; reopening starts at page 1 with an empty find box |

## Cloudflare (call budget, every release)

Run on the Cloudflare testbed with the plugin from the registry, the kit from the release tag, and a busy help centre (300 articles, 12 top-level categories with icons, a few hundred votes and searches). Every case must answer without "Too many subrequests" and without "Something went wrong". Then repeat C-1 to C-3 on the Node lab.

| ID | Steps | Expected |
| --- | --- | --- |
| C-1 | Guest opens an article, votes Yes, then No with a comment | Thanks, then the comment box, then the comment thanks. Reload: the tally line counts the vote once, as No |
| C-2 | Member does the same on another article | Same, counted once by account |
| C-3 | Guest searches for a known word, a new word and nonsense; open Searches | All three listed; nonsense under Searches with no results; Insights searches this week up by three |
| C-4 | Help home with 12 product cards; FAQ page; a category | Each loads, each card has its icon |
| C-5 | Insights load (and Continue until the full page on an updated site), Visitor pages are set up, reload, Show the setup steps again | Each loads; "set up" stays after the reload |
| C-6 | Searches: load, Find, Load more, Previous page, First page | Each loads |
| C-7 | Settings: load, save each tab (Feedback, Still need help, Search, Product icons with 12 icons) | Each saves with a success message and shows the saved value |
| C-8 | Dashboard KnowX card | Loads with empty searches this week and the least helpful article by name |

## Presentation, every screen

| ID | Steps | Expected |
| --- | --- | --- |
| P-1 | Every screen at 1440, 768 and 390 | No sideways scroll |
| P-2 | Switch the system to dark mode | All text readable. No white panel on a dark page |
| P-3 | Measure text contrast | Body text 4.5:1, large text 3:1 |
| P-4 | Measure buttons, inputs, tabs | At least 40px tall |
| P-5 | Tab through every control | Everything reachable, focus ring visible, forms usable by keyboard |
| P-6 | Empty, loading and error states | Each list has an empty state with a next step. A failed request shows a message |
| P-7 | Look for raw ids | No screen shows an id where a name belongs |
| P-8 | View page source as two different visitors | Kit markup is identical. No member data in the HTML |

## Known gaps

- Starter site header stays light in dark. The kit must still paint its own `.kx` canvas (T-80). A 0.1.1 bounce on #20 was that Topics and article body used light text on the host page.
- The collection setting is internal. A-4 is proven by setting `collection` to `no-such` in tests, not from the Settings screen.
- A block inside article text needs a trusted install. It is not in this registry release.
- Cloudflare: each plugin call may make 10 requests to the site. `tests/bridge-budget.test.ts` measures every route, admin page and action on a busy seed and fails over 9. It does not run on Cloudflare itself, so C-1 to C-8 are walked there every release.
