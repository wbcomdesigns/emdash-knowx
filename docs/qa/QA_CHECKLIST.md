# QA checklist: KnowX Knowledge Base

One living list of flow-level cases. Walk all of it before every release. When you add or fix behaviour, add or change its case in the same pull request. There are no per-release QA files.

**Last walk:** 2026-10-14, 0.1.1 team issues #22/#23/#24 on lab :4333 after reset. `npm test` 23 passed. `prove-lab.sh` passed (including search excerpt line).

Walked in the browser: G-1 (search welcome), G-2 (no-results), G-4 (Yes vote), G-7 (help home Topics + articles), G-8 (Help / Getting started / First week), G-10 (missing article URL), #22.2 (search line is the excerpt, not a repeated title), #22.3 (space after each breadcrumb slash). Presentation: 1440/768/390, light and dark, no horizontal overflow on home and article. Registry shots retaken at 1440x900 from the styled blog lab. Banner 3000x1000.

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
| A-1 | Open Insights with no data | Every table shows an empty state |
| A-2 | Open Insights after votes and searches | Least helpful articles by name, comments, top searches, no-result searches |
| A-3 | Search for `<script>` as a guest, then open Insights | The term shows as plain text |
| A-4 | Change the collection setting to one that does not exist | A clear message. Search returns nothing instead of failing |
| A-5 | Set the contact link to a `javascript:` address | Refused. Only a path, an http(s) link or a mailto address is accepted |
| A-6 | Open the EmDash dashboard | The KnowX card shows empty searches this week and the least helpful article, with a link to Insights |

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
