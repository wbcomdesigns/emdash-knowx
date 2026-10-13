# Browser walk: KnowX 0.1.0 (2026-10-14)

Submit walk on `http://localhost:4333`, isolated Chromium, after the remaining 0.1.0 cards. Guest, subscriber and admin.

## Owner line

A visitor can search, open an article, vote, and reach a contact link. An owner can read Insights and change Settings. Three kit defects were found in the walk; two were fixed the same day (copy-link size, LiveSearch leftover text). Dark cards now follow the system setting.

## Cases

| ID | Result |
| --- | --- |
| G-1 | PASS. Search `welcome` lists Welcome as a Help article |
| G-2 | PASS. Nonsense search shows no-results plus a next step |
| G-3 | PASS. Email search is not listed on Insights |
| G-4 | PASS. Yes shows Thanks |
| G-5 | PASS. No opens a comment box; comment saves |
| G-6 | PASS. Same visitor flipped Yes to No |
| G-7 | PASS. Home search + three product cards with counts |
| G-8 | PARTIAL. Top-level category works. No nested term in the seed |
| G-9 | PASS. TOC jumps to `#open-search` |
| G-10 | PASS. Missing slug is HTTP 404 with the kit message |
| G-11 | PASS after fix. Typing `welcome` lists the article. First run also showed leftover Searching / no-results text |
| G-13 | PASS. Still need help after No and after an empty search when contact is set |
| G-15 | PASS. After ticking Posts, LiveSearch and the results page show a Post labelled as a post |
| A-2 | PASS. Insights names Welcome, shows comments, top searches, empty searches |
| A-3 | PASS. `<script>qa-rft</script>` is plain text on Insights |
| A-5 | PASS. `javascript:alert(1)` toast: nothing was changed |
| P-1 | PASS. No sideways overflow at 1440 / 1024 / 390 |
| P-2 | PARTIAL. Kit cards go dark. Starter header stays light |
| P-4 | PASS after fix. Copy-link and Yes/No are 44px. Site header search (36px) is not ours |
| P-7 | PASS after fix. LiveSearch prints Help article and Post, not DOCS / POSTS |
| M-1 | PASS. Signed-in subscriber vote works the same |
| A-6 | PASS. Dashboard card: empty searches this week, least helpful article, link to Insights |

## Fixes in this pass

- Copy-link CSS targeted a child button that does not exist. Height was 21px. Selector now matches the button (44px).
- DocSearch slots omitted LiveSearch's hide classes, so "Searching" and "No articles match" stayed visible with results.
- `.kx` now sets `color-scheme: light dark` so kit surfaces follow the system setting.

## Submit-walk extras

LiveSearch labels remapped from collection slugs. Dashboard card answers `page: "widget:insights"`. Registry screenshots are in `images/screenshot-*.jpg`.

## Not walked

G-12, G-14 (contact was already set), G-92, A-1, A-4, P-3 numbers, P-5 full keyboard pass, P-8.
